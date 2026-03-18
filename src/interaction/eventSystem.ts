import * as PIXI from 'pixi.js'
import { store, setActiveNode, addEdge } from '../core/store'
import { screenToWorld, applyViewportToPan, applyViewportZoom } from '../core/viewport'
import { toolState } from '../core/toolState'
import { hitTest } from './hitTest'
import { startDrag, moveDrag, endDrag, isDragging } from './drag'
import { startBoxSelect, updateBoxSelect, endBoxSelect, selectNode, deselectAll, isBoxSelecting } from './select'
import { applyViewportToScene, getScene } from '../renderer/scene'
import { refreshNode } from '../renderer/nodeRenderer'
import { renderEdge, updateEdge } from '../renderer/edgeRenderer'
import { connectionState, cancelConnection, completeConnection } from './connectionState'
import { getHoveredFieldKey, isFieldPortableNode } from '../core/port'
import { createEdge } from '../core/edge'
import { resolveNodeTypeConfig } from '../core/nodeTypeRegistry'

const DRAG_THRESHOLD = 4

interface PointerSession {
  startX: number
  startY: number
  moved: boolean
  button: number
  targetNodeId: string | null
  isPanning: boolean
}

let session: PointerSession | null = null

function isPanMode(): boolean {
  return toolState.current === 'pan' || toolState.spacePanning
}

function syncViewport() {
  const { x, y, zoom } = store.viewport
  applyViewportToScene(x, y, zoom)
}

function onPointerDown(e: PointerEvent) {
  const { clientX, clientY, button } = e

  const world = screenToWorld(clientX, clientY)
  const hitNode = hitTest(world.x, world.y)

  // ─── 连线模式：点击目标节点/字段完成连线 ─────────────────────
  if (connectionState.active && button === 0) {
    if (hitNode && hitNode.id !== connectionState.sourcePort?.nodeId) {
      // 判断是否命中字段行
      const fieldKey = isFieldPortableNode(hitNode)
        ? getHoveredFieldKey(hitNode, world.y)
        : null
      const targetPort = fieldKey
        ? { nodeId: hitNode.id, portType: 'field' as const, fieldKey }
        : { nodeId: hitNode.id, portType: 'node' as const }
      const conn = completeConnection(targetPort)
      if (conn) {
        const edge = createEdge({
          id: `e-${Date.now()}`,
          source: conn.source.nodeId,
          target: conn.target.nodeId,
          sourcePort: conn.source,
          targetPort: conn.target
        })
        addEdge(edge)
        const { edges: edgesLayer } = getScene()
        renderEdge(edge, store.nodes, edgesLayer)
      }
    } else {
      cancelConnection()
    }
    e.stopPropagation()
    return
  }

  const panningNow = isPanMode() || button === 1 || button === 2

  session = {
    startX: clientX,
    startY: clientY,
    moved: false,
    button,
    targetNodeId: hitNode?.id ?? null,
    isPanning: panningNow && button === 0
  }

  if (button === 0 && !panningNow) {
    if (hitNode) {
      if (!store.selectedNodeIds.has(hitNode.id)) {
        const additive = e.shiftKey || e.metaKey || e.ctrlKey
        selectNode(hitNode, additive)
      }
      startDrag(hitNode, clientX, clientY)
    } else {
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        deselectAll()
        setActiveNode(null)
      }
      startBoxSelect(world.x, world.y)
    }
  }
}

function onPointerMove(e: PointerEvent) {
  // ─── 连线模式：更新鼠标位置给 overlay 用 ──────────────────────
  const world = screenToWorld(e.clientX, e.clientY)
  if (connectionState.active) {
    connectionState.mouseWorldX = world.x
    connectionState.mouseWorldY = world.y
    connectionState.mouseScreenX = e.clientX
    connectionState.mouseScreenY = e.clientY
  }

  // ─── 更新悬停节点/字段（供 PortOverlay 使用）────────────────
  const hovered = hitTest(world.x, world.y)
  connectionState.hoveredNodeId = hovered?.id ?? null
  connectionState.hoveredFieldKey = hovered && isFieldPortableNode(hovered)
    ? getHoveredFieldKey(hovered, world.y)
    : null

  if (!session) return

  const dx = e.clientX - session.startX
  const dy = e.clientY - session.startY

  if (!session.moved && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
    session.moved = true
  }

  if (!session.moved) return

  // 画布拖拽平移：中键 / 右键 / pan工具 / space+左键
  if (session.button === 1 || session.button === 2 || session.isPanning) {
    applyViewportToPan(e.movementX, e.movementY)
    syncViewport()
    return
  }

  if (isDragging()) {
    const movedNode = moveDrag(e.clientX, e.clientY, store.nodes)
    if (movedNode) {
      store.edges.forEach(edge => {
        if (edge.source === movedNode.id || edge.target === movedNode.id) {
          updateEdge(edge, store.nodes)
        }
      })
    }
  } else if (isBoxSelecting()) {
    const world = screenToWorld(e.clientX, e.clientY)
    const { selection } = getScene()
    const sg = selection.children[0] as PIXI.Graphics
    if (sg) updateBoxSelect(world.x, world.y, sg)
  }
}

function onPointerUp(e: PointerEvent) {
  if (!session) return

  if (!session.moved && !session.isPanning) {
    const world = screenToWorld(e.clientX, e.clientY)
    const hitNode = hitTest(world.x, world.y)

    if (hitNode) {
      // 选中节点（始终执行）
      const additive = e.shiftKey || e.metaKey || e.ctrlKey
      if (!store.selectedNodeIds.has(hitNode.id)) {
        selectNode(hitNode, additive)
      }
      refreshNode(hitNode)

      // 按 clickBehavior 决定是否进入编辑态
      const cfg = resolveNodeTypeConfig(hitNode)
      const behavior = cfg?.clickBehavior ?? 'select'

      if (behavior === 'edit') {
        const prevActive = store.activeNodeId
        if (prevActive === hitNode.id) {
          // 再次点击同一节点：关闭编辑
          setActiveNode(null)
          refreshNode(hitNode)
        } else {
          setActiveNode(hitNode.id)
          if (prevActive) {
            const prev = store.nodes.get(prevActive)
            if (prev) refreshNode(prev)
          }
        }
      } else {
        // select 模式：点击空白处或其他节点时关闭当前编辑
        if (store.activeNodeId && store.activeNodeId !== hitNode.id) {
          const prev = store.nodes.get(store.activeNodeId)
          setActiveNode(null)
          if (prev) refreshNode(prev)
        }
      }
    } else {
      // 点击空白：关闭编辑态
      if (store.activeNodeId) {
        const prev = store.nodes.get(store.activeNodeId)
        setActiveNode(null)
        if (prev) refreshNode(prev)
      }
    }
  }

  if (isDragging()) endDrag()

  if (isBoxSelecting()) {
    const selected = endBoxSelect()
    if (selected.length > 0) {
      selected.forEach(n => selectNode(n, true))
    }
  }

  session = null
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  applyViewportZoom(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY)
  syncViewport()
}

function onContextMenu(e: Event) {
  e.preventDefault()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Escape') {
    cancelConnection()
  }
  if (e.code === 'Space' && !e.repeat) {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
    e.preventDefault()
    toolState.spacePanning = true
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    toolState.spacePanning = false
  }
}

export function initEventSystem(canvas: HTMLCanvasElement) {
  const { selection } = getScene()
  const selectionBox = new PIXI.Graphics()
  selection.addChild(selectionBox)

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }
}

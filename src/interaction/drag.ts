import type { NodeModel } from '../core/node'
import { screenToWorld } from '../core/viewport'
import { updateNodeInIndex } from './hitTest'
import { refreshNode } from '../renderer/nodeRenderer'

interface DragState {
  nodeId: string
  startWorldX: number
  startWorldY: number
  nodeStartX: number
  nodeStartY: number
}

let dragState: DragState | null = null

export function startDrag(node: NodeModel, screenX: number, screenY: number) {
  const world = screenToWorld(screenX, screenY)
  dragState = {
    nodeId: node.id,
    startWorldX: world.x,
    startWorldY: world.y,
    nodeStartX: node.x,
    nodeStartY: node.y
  }
}

export function moveDrag(
  screenX: number,
  screenY: number,
  nodes: Map<string, NodeModel>
): NodeModel | null {
  if (!dragState) return null

  const world = screenToWorld(screenX, screenY)
  const dx = world.x - dragState.startWorldX
  const dy = world.y - dragState.startWorldY

  const node = nodes.get(dragState.nodeId)
  if (!node) return null

  node.x = dragState.nodeStartX + dx
  node.y = dragState.nodeStartY + dy

  updateNodeInIndex(node)
  refreshNode(node)

  return node
}

export function endDrag(): string | null {
  const id = dragState?.nodeId ?? null
  dragState = null
  return id
}

export function isDragging(): boolean {
  return dragState !== null
}

export function getDragNodeId(): string | null {
  return dragState?.nodeId ?? null
}

<template>
  <div
    ref="rootRef"
    class="pixi-graph-canvas"
    :style="containerStyle"
    :class="{ 'mode-pan': isPanning }"
  >
    <canvas ref="canvasRef" class="pixi-graph-canvas__canvas" />

    <!-- DOM Overlay（节点编辑器定位层） -->
    <div class="pixi-graph-canvas__overlay">
      <Overlay />
    </div>

    <!-- 工具栏 -->
    <Toolbar v-if="showToolbar" />

    <!-- MiniMap -->
    <MiniMap v-if="showMinimap" ref="miniMapRef" />

    <!-- 自定义插槽（追加 UI） -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

import Overlay from '../ui/Overlay.vue'
import Toolbar from '../ui/Toolbar.vue'
import MiniMap from '../ui/MiniMap.vue'

import { createPixiApp, destroyPixiApp } from '../renderer/app'
import { initScene, getScene, applyViewportToScene } from '../renderer/scene'
import { renderNode, removeNode as removeNodeGraphics, clearAllNodes, refreshNode } from '../renderer/nodeRenderer'
import { renderEdge, removeEdge as removeEdgeGraphics, clearAllEdges, updateEdge } from '../renderer/edgeRenderer'
import { rebuildIndex } from '../interaction/hitTest'
import { initEventSystem } from '../interaction/eventSystem'

import { store, addNode as storeAddNode, removeNode as storeRemoveNode, addEdge as storeAddEdge, setActiveNode } from '../core/store'
import type { AppStore, ViewportState } from '../core/store'
import { createNode } from '../core/node'
import type { NodeModel, NodeType } from '../core/node'
import { createEdge } from '../core/edge'
import type { EdgeModel } from '../core/edge'
import { computeLayout } from '../layout/index'
import { toolState, setTool } from '../core/toolState'
import type { ToolMode } from '../core/toolState'
import { setMinimapPosition, setMinimapVisible } from '../ui/minimapConfig'
import type { MinimapPosition } from '../ui/minimapConfig'
import { applyViewportZoom } from '../core/viewport'

// ─── Props ───────────────────────────────────────────────────
interface Props {
  /** 初始节点列表 */
  initialNodes?: NodeModel[]
  /** 初始边列表 */
  initialEdges?: EdgeModel[]
  /** 是否显示顶部工具栏（默认 true） */
  showToolbar?: boolean
  /** 是否显示右下角 MiniMap（默认 true） */
  showMinimap?: boolean
  /** 画布背景色（PixiJS 颜色值，默认 0xf0f2f5） */
  backgroundColor?: number
  /** 容器宽度（CSS 字符串，默认 '100%'） */
  width?: string
  /** 容器高度（CSS 字符串，默认 '100vh'） */
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  showToolbar: true,
  showMinimap: true,
  backgroundColor: 0xf0f2f5,
  width: '100%',
  height: '100vh'
})

// ─── Emits ───────────────────────────────────────────────────
const emit = defineEmits<{
  /** 画布就绪 */
  ready: []
  /** 节点被点击激活（可编辑） */
  'node-click': [node: NodeModel]
  /** 节点编辑面板关闭 */
  'node-close': [node: NodeModel]
  /** 视口发生变化（平移 / 缩放） */
  'viewport-change': [viewport: ViewportState]
  /** 节点被拖拽移动后 */
  'node-move': [node: NodeModel]
}>()

// ─── Refs ────────────────────────────────────────────────────
const rootRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const miniMapRef = ref<InstanceType<typeof MiniMap> | null>(null)

let cleanupEvents: (() => void) | null = null

// ─── 样式 ────────────────────────────────────────────────────
const containerStyle = computed(() => ({
  width: props.width,
  height: props.height
}))

const isPanning = computed(() => toolState.current === 'pan' || toolState.spacePanning)

// ─── 初始化 ──────────────────────────────────────────────────
async function initialize() {
  if (!canvasRef.value) return

  // 清除旧状态（组件重挂时）
  clearAllNodes()
  clearAllEdges()
  store.nodes.clear()
  store.edges.clear()
  store.activeNodeId = null
  store.viewport.x = 0
  store.viewport.y = 0
  store.viewport.zoom = 1

  const app = await createPixiApp(canvasRef.value, {
    backgroundColor: props.backgroundColor
  })
  const { nodes: nodesContainer, edges: edgesContainer } = initScene(app)

  // 加载初始数据
  if (props.initialNodes) {
    for (const n of props.initialNodes) {
      const node = { ...n, layout: n.layout ?? computeLayout(n) }
      storeAddNode(node)
      renderNode(node, nodesContainer)
    }
  }

  if (props.initialEdges) {
    for (const e of props.initialEdges) {
      storeAddEdge(e)
      renderEdge(e, store.nodes, edgesContainer)
    }
  }

  rebuildIndex(store.nodes)
  cleanupEvents = initEventSystem(canvasRef.value)

  emit('ready')
}

onMounted(() => initialize())

onUnmounted(() => {
  cleanupEvents?.()
  destroyPixiApp()
})

// ─── 监听 viewport 变化 → emit ───────────────────────────────
watch(
  () => ({ ...store.viewport }),
  (vp) => emit('viewport-change', vp),
  { deep: true }
)

// ─── 监听 activeNodeId 变化 → emit ──────────────────────────
watch(
  () => store.activeNodeId,
  (id) => {
    if (id) {
      const node = store.nodes.get(id)
      if (node) emit('node-click', node)
    }
  }
)

// ─── 公开 API（defineExpose）────────────────────────────────

/** 添加节点到画布 */
function addNode(nodeOrPartial: NodeModel | (Omit<NodeModel, 'layout' | 'state'> & Partial<Pick<NodeModel, 'layout' | 'state'>>)): NodeModel {
  const node = createNode(nodeOrPartial as any)
  if (!node.layout || (node.layout.readonly.width === 240 && node.layout.readonly.height === 68)) {
    node.layout = computeLayout(node)
  }
  storeAddNode(node)
  try {
    const { nodes: nodesContainer } = getScene()
    renderNode(node, nodesContainer)
  } catch { /* scene not ready */ }
  rebuildIndex(store.nodes)
  return node
}

/** 通过 id 删除节点 */
function removeNode(id: string) {
  const node = store.nodes.get(id)
  if (!node) return
  removeNodeGraphics(id)
  storeRemoveNode(id)
  rebuildIndex(store.nodes)
}

/** 添加边 */
function addEdge(edge: EdgeModel): EdgeModel {
  storeAddEdge(edge)
  try {
    const { edges: edgesContainer } = getScene()
    renderEdge(edge, store.nodes, edgesContainer)
  } catch { /* scene not ready */ }
  return edge
}

/** 删除边 */
function removeEdge(id: string) {
  removeEdgeGraphics(id)
  store.edges.delete(id)
}

/** 适应视图（自动缩放展示所有节点） */
function fitView() {
  miniMapRef.value?.fitView()
}

/** 切换工具模式 */
function switchTool(mode: ToolMode) {
  setTool(mode)
}

/** 更新 minimap 位置 */
function updateMinimapPosition(pos: MinimapPosition) {
  setMinimapPosition(pos)
}

/** 显示 / 隐藏 minimap */
function toggleMinimap(visible: boolean) {
  setMinimapVisible(visible)
}

/** 缩放到指定比例 */
function zoomTo(scale: number) {
  const cx = (rootRef.value?.clientWidth ?? window.innerWidth) / 2
  const cy = (rootRef.value?.clientHeight ?? window.innerHeight) / 2
  const delta = scale > store.viewport.zoom ? 1 : -1
  const steps = Math.abs(Math.round(Math.log(scale / store.viewport.zoom) / Math.log(1.1)))
  for (let i = 0; i < steps; i++) {
    applyViewportZoom(delta, cx, cy)
  }
  applyViewportToScene(store.viewport.x, store.viewport.y, store.viewport.zoom)
}

/** 返回当前响应式 store（只读引用） */
function getStore(): AppStore {
  return store
}

/** 返回所有节点 */
function getNodes(): NodeModel[] {
  return [...store.nodes.values()]
}

/** 返回所有边 */
function getEdges(): EdgeModel[] {
  return [...store.edges.values()]
}

defineExpose({
  addNode,
  removeNode,
  addEdge,
  removeEdge,
  fitView,
  switchTool,
  updateMinimapPosition,
  toggleMinimap,
  zoomTo,
  getStore,
  getNodes,
  getEdges,
  /** 直接访问响应式 store */
  store
})
</script>

<style scoped>
.pixi-graph-canvas {
  position: relative;
  overflow: hidden;
  background: #f0f2f5;
  font-family: system-ui, sans-serif;
}

.pixi-graph-canvas__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.pixi-graph-canvas__overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  overflow: visible;
}

.pixi-graph-canvas.mode-pan,
.pixi-graph-canvas.mode-pan .pixi-graph-canvas__canvas {
  cursor: grab;
}

.pixi-graph-canvas.mode-pan:active .pixi-graph-canvas__canvas {
  cursor: grabbing;
}
</style>

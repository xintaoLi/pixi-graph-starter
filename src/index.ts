/**
 * pixi-graph-engine
 *
 * 使用方式一：Vue 插件（全局注册所有组件）
 *   import PixiGraphEngine from 'pixi-graph-engine'
 *   app.use(PixiGraphEngine)
 *   // 然后在模板中直接使用 <PixiGraphCanvas />
 *
 * 使用方式二：按需引入组件
 *   import { PixiGraphCanvas, MiniMap } from 'pixi-graph-engine'
 *
 * 使用方式三：引入 core 模块自定义实现
 *   import { store, computeLayout, renderNode, initEventSystem } from 'pixi-graph-engine'
 */

// ── Vue Plugin（默认导出）────────────────────────────────────
export { default } from './plugin'

// ── 顶层组合式组件 ───────────────────────────────────────────
export { default as PixiGraphCanvas } from './components/PixiGraphCanvas.vue'

// ── 可单独使用的 UI 子组件 ──────────────────────────────────
export { default as MiniMap } from './ui/MiniMap.vue'
export { default as Toolbar } from './ui/Toolbar.vue'
export { default as NodeEditor } from './ui/NodeEditor.vue'
export { default as Overlay } from './ui/Overlay.vue'

// ── MiniMap 位置 API ────────────────────────────────────────
export {
  minimapConfig,
  setMinimapPosition,
  setMinimapSize,
  setMinimapVisible
} from './ui/minimapConfig'
export type { MinimapConfig, MinimapPosition } from './ui/minimapConfig'

// ── Core：数据模型与 Store ───────────────────────────────────
export {
  createNode
} from './core/node'
export type { NodeModel, NodeType, NodeLayout, NodeState, LayoutBox, NodeIconMeta } from './core/node'

export {
  createEdge
} from './core/edge'
export type { EdgeModel } from './core/edge'

export {
  store,
  addNode,
  removeNode,
  addEdge,
  setActiveNode,
  setSelected
} from './core/store'
export type { AppStore, ViewportState } from './core/store'

// ── Core：视口变换 ──────────────────────────────────────────
export {
  worldToScreen,
  screenToWorld,
  applyViewportToPan,
  applyViewportZoom
} from './core/viewport'

// ── Core：工具模式 ──────────────────────────────────────────
export {
  toolState,
  setTool
} from './core/toolState'
export type { ToolMode } from './core/toolState'

// ── Layout Engine ───────────────────────────────────────────
export {
  computeLayout,
  invalidateLayoutCache,
  clearLayoutCache
} from './layout/index'

// ── Icon 注册表 ──────────────────────────────────────────────
export {
  setDefaultIconFont,
  getDefaultIconFont,
  registerNodeTypeIcon,
  registerNodeTypeIcons,
  unregisterNodeTypeIcon,
  clearIconRegistry,
  resolveIconConfig
} from './renderer/iconRegistry'
export type { IconConfig } from './renderer/iconRegistry'

// ── Renderer ────────────────────────────────────────────────
export {
  createPixiApp,
  getPixiApp,
  destroyPixiApp
} from './renderer/app'

export {
  initScene,
  getScene,
  applyViewportToScene
} from './renderer/scene'
export type { SceneContainers } from './renderer/scene'

export {
  renderNode,
  removeNode as removeNodeGraphics,
  refreshNode,
  clearAllNodes
} from './renderer/nodeRenderer'

export {
  renderEdge,
  updateEdge,
  removeEdge as removeEdgeGraphics,
  clearAllEdges
} from './renderer/edgeRenderer'

// ── Interaction ─────────────────────────────────────────────
export {
  rebuildIndex,
  updateNodeInIndex,
  hitTest,
  searchInRect,
  removeNodeFromIndex
} from './interaction/hitTest'

export {
  startDrag,
  moveDrag,
  endDrag,
  isDragging,
  getDragNodeId
} from './interaction/drag'

export {
  selectNode,
  deselectAll,
  startBoxSelect,
  updateBoxSelect,
  endBoxSelect,
  isBoxSelecting
} from './interaction/select'

export {
  initEventSystem
} from './interaction/eventSystem'

// ── X6 迁移工具 ─────────────────────────────────────────────
export {
  mapX6Type,
  fromX6Node,
  fromX6Edge,
  migrateGraph
} from './adapter/x6Adapter'
export type {
  X6NodeShape,
  X6EdgeShape,
  X6GraphShape,
  MigrateResult
} from './adapter/x6Adapter'

import type { Component } from 'vue'
import type { NodeModel } from './node'

// ─── 枚举与基础类型 ───────────────────────────────────────────

export type NodeHeightMode = 'compact' | 'full'

export type BaseNodeType = 'object' | 'array' | 'table' | 'json' | 'text'

/** hover 弹出工具栏配置 */
export interface HoverToolbarConfig {
  /** 工具栏出现的位置（默认 top-right） */
  position?: 'top-right' | 'top-left' | 'bottom'
  /**
   * 渲染的操作内容
   * - Vue Component：接收 `{ node: NodeModel }` 作为 props
   * - HTML string：直接通过 v-html 渲染
   */
  actions: Component | string
}

// ─── 节点类型配置 ─────────────────────────────────────────────

export interface NodeTypeConfig {
  /** 基础类型，决定布局算法和默认数据结构 */
  base: BaseNodeType

  // ── 外观 ──────────────────────────────────────────────────

  /** 自定义 header 高度（px，默认 32） */
  headerHeight?: number
  /** 自定义 header 背景色（0xRRGGBB 格式） */
  headerBackground?: number
  /** 自定义字体图标 */
  fontIcon?: { icon: string; fontFamily?: string }

  // ── 状态 ──────────────────────────────────────────────────

  /** 是否在 header 右侧显示状态指示器区域（默认 false） */
  showStatus?: boolean

  // ── 交互 ──────────────────────────────────────────────────

  /**
   * 点击节点时的行为（默认 'select'）
   * - `select`：仅选中节点（默认）
   * - `edit`：直接进入编辑态（打开 HTML 编辑面板）
   */
  clickBehavior?: 'select' | 'edit'
  /** hover 节点时弹出的工具栏配置 */
  hoverToolbar?: HoverToolbarConfig
  /** 是否支持编辑（显示编辑按钮，默认 false） */
  editable?: boolean

  // ── 内容高度 ──────────────────────────────────────────────

  /**
   * 内容高度模式
   * - `compact`（默认）：在 PixiJS Canvas 内有限行数渲染
   * - `full`：使用 HTML overlay 展示全量数据，高度自适应内容
   */
  heightMode?: NodeHeightMode
  /**
   * `full` 模式下 Canvas 节点的占位高度（px，默认 200）
   * 初始渲染时使用此高度，HTML overlay mount 后测量实际高度并同步
   */
  defaultHeight?: number
}

// ─── 注册表 ──────────────────────────────────────────────────

const registry = new Map<string, NodeTypeConfig>()

/** 注册自定义节点类型 */
export function registerNodeType(typeName: string, config: NodeTypeConfig): void {
  registry.set(typeName, {
    heightMode: 'compact',
    editable: false,
    showStatus: false,
    ...config
  })
}

/** 批量注册 */
export function registerNodeTypes(configs: Record<string, NodeTypeConfig>): void {
  Object.entries(configs).forEach(([k, v]) => registerNodeType(k, v))
}

/** 获取节点类型配置 */
export function getNodeTypeConfig(typeName: string): NodeTypeConfig | undefined {
  return registry.get(typeName)
}

/**
 * 解析节点的有效配置：
 * - 如果 `node.customType` 存在，从注册表获取
 * - 否则返回 undefined（走内置默认逻辑）
 */
export function resolveNodeTypeConfig(node: NodeModel): NodeTypeConfig | undefined {
  if (node.customType) return registry.get(node.customType)
  return undefined
}

/** 获取全部已注册类型（只读） */
export function getAllNodeTypes(): ReadonlyMap<string, NodeTypeConfig> {
  return registry
}

export function clearNodeTypeRegistry(): void {
  registry.clear()
}

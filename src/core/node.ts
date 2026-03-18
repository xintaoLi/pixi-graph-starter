export type NodeType = 'object' | 'array' | 'table' | 'json' | 'text'

// ─── 节点状态 ─────────────────────────────────────────────────

/**
 * 节点的运行时状态（用于 header 状态指示器）
 * - idle: 默认无状态
 * - loading: 加载中（旋转动画）
 * - success: 成功（绿色对勾）
 * - error: 错误（红色叉号）
 */
export type NodeStatus = 'idle' | 'loading' | 'success' | 'error'

// ─── 字段级类型系统 ───────────────────────────────────────────

/** 每个字段/属性可携带的数据类型 */
export type FieldType = 'string' | 'array' | 'object' | 'table' | 'json' | 'custom'

/** 带类型标注的字段定义 */
export interface FieldDef {
  /** 字段数据类型 */
  type: FieldType
  /** 字段值 */
  value: any
  /** 可选的显示标签（默认使用 key 名） */
  label?: string
}

/** 判断一个值是否为 FieldDef（带 type + value 的结构） */
export function isFieldDef(v: unknown): v is FieldDef {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
  const o = v as Record<string, unknown>
  return typeof o.type === 'string' && 'value' in o
}

/** 判断 node.data 是否使用了 FieldDef 字段格式 */
export function hasTypedFields(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  return Object.values(data as Record<string, unknown>).some(isFieldDef)
}

/** 创建一个 FieldDef */
export function createField(type: FieldType, value?: any): FieldDef {
  const defaults: Record<FieldType, any> = {
    string: '',
    array: [],
    object: {},
    table: { columns: ['col1'], rows: [] },
    json: {},
    custom: ''
  }
  return { type, value: value ?? defaults[type] }
}

export interface LayoutBox {
  width: number
  height: number
}

export interface NodeLayout {
  readonly: LayoutBox
  edit: LayoutBox
}

export interface NodeState {
  selected: boolean
  hover: boolean
  editing: boolean
}

/**
 * 节点 header 图标配置（节点级，优先于类型级注册表）
 */
export interface NodeIconMeta {
  /**
   * 图标字符。可以是：
   * - Unicode 字符（如 '⬡'、'◈'）
   * - emoji（如 '🗄️'）
   * - Font icon 的 unicode 码点（如 '\ue1d0' for Material Icons）
   */
  icon: string
  /**
   * 渲染该图标使用的 fontFamily。
   * 填写你的 icon font 名称，如 'Material Icons'、'Font Awesome 5 Free'、'iconfont'。
   * 不填则继承全局默认 iconFont。
   */
  fontFamily?: string
  /** 覆盖 header 背景色（十六进制数字，如 0xff6b35） */
  headerColor?: number
  /** 覆盖 header 显示标签（不填则显示 id·type） */
  label?: string
}

export interface NodeModel {
  id: string
  type: NodeType
  x: number
  y: number
  data: any
  layout: NodeLayout
  state: NodeState
  /** 可选的节点外观元数据 */
  meta?: NodeIconMeta
  /**
   * 自定义节点类型名（对应 nodeTypeRegistry 中的注册 key）
   * 设置后会使用注册表中的 NodeTypeConfig 覆盖默认外观和行为
   */
  customType?: string
  /**
   * 节点运行时状态（影响 header 右侧状态指示器）
   * 需要在注册的 NodeTypeConfig 中设置 showStatus: true 才会显示
   */
  status?: NodeStatus
}

export function createNode(partial: Partial<NodeModel> & Pick<NodeModel, 'id' | 'type' | 'x' | 'y' | 'data'>): NodeModel {
  return {
    layout: {
      readonly: { width: 240, height: 68 },
      edit: { width: 300, height: 122 }
    },
    state: {
      selected: false,
      hover: false,
      editing: false
    },
    ...partial
  }
}

/**
 * 节点 Header 图标注册表
 *
 * 使用方式：
 *
 * 1. 注册类型级默认图标（仅 unicode/emoji，无需 icon font）
 *    registerNodeTypeIcon('database', { icon: '🗄' })
 *
 * 2. 注册类型级自定义 font icon（需要提前加载对应 font）
 *    setDefaultIconFont('Material Icons')
 *    registerNodeTypeIcon('database', { icon: '\ue1d0' })
 *    registerNodeTypeIcon('api',      { icon: '\ue8b8' })
 *
 * 3. 节点级覆盖（在 node.meta 中配置）
 *    createNode({ ..., meta: { icon: '\ue1d0', fontFamily: 'Material Icons' } })
 *
 * 4. 针对不同 icon font 混用
 *    registerNodeTypeIcon('custom', {
 *      icon: '\uf1c0',
 *      fontFamily: 'Font Awesome 5 Free'
 *    })
 */

import type { NodeModel } from '../core/node'

// ─── 数据结构 ─────────────────────────────────────────────────

export interface IconConfig {
  /** 图标字符（unicode / emoji / font icon 码点） */
  icon: string
  /**
   * 渲染此图标所用的 fontFamily。
   * 若不填则使用 defaultIconFont（全局默认）。
   */
  fontFamily?: string
}

// ─── 注册表 ──────────────────────────────────────────────────

/** 全局默认 icon font（为空则使用 system-ui 渲染 unicode/emoji） */
let defaultIconFont = 'system-ui, sans-serif'

/** type -> IconConfig 映射 */
const typeRegistry = new Map<string, IconConfig>()

/** 内置 fallback：使用类型缩写文字标签 */
const BUILTIN_DEFAULTS: Record<string, IconConfig> = {
  object: { icon: 'Obj'   },
  array:  { icon: 'Arr'   },
  table:  { icon: 'Table' },
  json:   { icon: 'JSON'  },
  text:   { icon: 'Str'   }
}

// ─── 公开 API ────────────────────────────────────────────────

/**
 * 设置全局默认 icon font。
 * 当 IconConfig / NodeIconMeta 都未指定 fontFamily 时使用此值。
 *
 * @example
 * setDefaultIconFont('Material Icons')
 * setDefaultIconFont('iconfont')
 */
export function setDefaultIconFont(fontFamily: string) {
  defaultIconFont = fontFamily
}

export function getDefaultIconFont(): string {
  return defaultIconFont
}

/**
 * 注册某个 nodeType 的默认图标。
 * 可随时调用，会覆盖之前的注册。
 *
 * @param nodeType  节点类型字符串（如 'object'、'database'、'api' 等）
 * @param config    图标配置
 *
 * @example
 * // 使用 Material Icons（需预先加载字体）
 * setDefaultIconFont('Material Icons')
 * registerNodeTypeIcon('database', { icon: '\ue1d0' })
 * registerNodeTypeIcon('api',      { icon: '\ue8b8' })
 *
 * // 仅用 unicode（无需任何字体）
 * registerNodeTypeIcon('workflow', { icon: '⚡' })
 */
export function registerNodeTypeIcon(nodeType: string, config: IconConfig) {
  typeRegistry.set(nodeType, config)
}

/**
 * 批量注册图标（适合在应用初始化时一次性配置）
 *
 * @example
 * registerNodeTypeIcons({
 *   database: { icon: '\ue1d0' },
 *   api:      { icon: '\ue8b8' },
 *   service:  { icon: '\ue8b5' }
 * })
 */
export function registerNodeTypeIcons(map: Record<string, IconConfig>) {
  for (const [type, config] of Object.entries(map)) {
    typeRegistry.set(type, config)
  }
}

/**
 * 取消某个类型的图标注册（回退到内置默认）
 */
export function unregisterNodeTypeIcon(nodeType: string) {
  typeRegistry.delete(nodeType)
}

/**
 * 清空所有自定义注册（回退到内置默认）
 */
export function clearIconRegistry() {
  typeRegistry.clear()
}

/**
 * 根据节点实例解析最终使用的图标配置。
 * 优先级：node.meta.icon > typeRegistry > BUILTIN_DEFAULTS > null
 */
export function resolveIconConfig(node: NodeModel): IconConfig | null {
  // 1. 节点级覆盖
  if (node.meta?.icon) {
    return {
      icon: node.meta.icon,
      fontFamily: node.meta.fontFamily ?? getDefaultIconFont()
    }
  }

  // 2. 类型级注册表
  const registered = typeRegistry.get(node.type)
  if (registered) {
    return {
      icon: registered.icon,
      fontFamily: registered.fontFamily ?? getDefaultIconFont()
    }
  }

  // 3. 内置 fallback
  const builtin = BUILTIN_DEFAULTS[node.type]
  if (builtin) {
    return {
      icon: builtin.icon,
      fontFamily: getDefaultIconFont()
    }
  }

  return null
}

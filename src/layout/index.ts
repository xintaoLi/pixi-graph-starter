import type { NodeModel, NodeLayout } from '../core/node'
import type { LayoutContext } from './object'
import { computeObjectLayout } from './object'
import { computeArrayLayout } from './array'
import { computeTableLayout } from './table'
import { computeJsonLayout } from './jsonTree'
import { computeTextLayout } from './text'
import { resolveNodeTypeConfig } from '../core/nodeTypeRegistry'

const layoutCache = new Map<string, NodeLayout>()

const DEFAULT_HEADER_H = 32
const FULL_MODE_DEFAULT_HEIGHT = 200

function getCacheKey(node: Pick<NodeModel, 'type' | 'data' | 'customType'>): string {
  try {
    const prefix = node.customType ? `${node.customType}@${node.type}` : node.type
    return prefix + ':' + JSON.stringify(node.data)
  } catch {
    return node.type + ':' + String(node.data)
  }
}

export function computeLayout(
  node: Pick<NodeModel, 'type' | 'data'> & { customType?: string },
  context?: LayoutContext
): NodeLayout {
  const key = getCacheKey(node)

  if (layoutCache.has(key)) {
    return layoutCache.get(key)!
  }

  // ─── full 高度模式：使用注册表 defaultHeight 作为占位 ──────
  const typeConfig = resolveNodeTypeConfig(node as NodeModel)
  if (typeConfig?.heightMode === 'full') {
    const h = (typeConfig.defaultHeight ?? FULL_MODE_DEFAULT_HEIGHT)
    const headerH = typeConfig.headerHeight ?? DEFAULT_HEADER_H
    const result: NodeLayout = {
      readonly: { width: 240, height: headerH + h },
      edit: { width: 300, height: headerH + h }
    }
    layoutCache.set(key, result)
    return result
  }

  let result: NodeLayout

  switch (node.type) {
    case 'object':
      result = computeObjectLayout(node.data, context)
      break
    case 'array':
      result = computeArrayLayout(node.data, context)
      break
    case 'table':
      result = computeTableLayout(node.data)
      break
    case 'json':
      result = computeJsonLayout(node.data)
      break
    case 'text':
      result = computeTextLayout(node.data)
      break
    default:
      result = {
        readonly: { width: 240, height: 68 },
        edit: { width: 300, height: 120 }
      }
  }

  layoutCache.set(key, result)
  return result
}

export function invalidateLayoutCache(node: Pick<NodeModel, 'type' | 'data'> & { customType?: string }) {
  const key = getCacheKey(node)
  layoutCache.delete(key)
}

export function clearLayoutCache() {
  layoutCache.clear()
}

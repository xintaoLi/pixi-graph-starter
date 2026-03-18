import type { NodeLayout } from '../core/node'
import type { LayoutContext } from './object'
import {
  READONLY_HEADER_H,
  READONLY_ROW_H,
  READONLY_MAX_ROWS,
  READONLY_MORE_ROW_H
} from '../renderer/nodeRenderer'

export function computeArrayLayout(data: any[], context?: LayoutContext): NodeLayout {
  const itemEditH = context?.compact ? 24 : 32
  const padding   = 4

  const count        = Array.isArray(data) ? data.length : 0
  const visibleCount = Math.min(count, READONLY_MAX_ROWS)
  const hasMore      = count > READONLY_MAX_ROWS

  const readonlyHeight =
    READONLY_HEADER_H +
    visibleCount * READONLY_ROW_H +
    (hasMore ? READONLY_MORE_ROW_H : 0) +
    padding

  const editHeight =
    READONLY_HEADER_H +
    visibleCount * itemEditH +
    (hasMore ? 28 : 0) +
    padding + 12

  return {
    readonly: { width: 240, height: readonlyHeight },
    edit:     { width: 280, height: editHeight }
  }
}

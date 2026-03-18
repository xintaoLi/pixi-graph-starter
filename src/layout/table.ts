import type { NodeLayout } from '../core/node'
import {
  READONLY_HEADER_H,
  READONLY_TABLE_COL_HEADER_H,
  READONLY_TABLE_ROW_H,
  READONLY_MAX_ROWS,
  READONLY_MORE_ROW_H
} from '../renderer/nodeRenderer'

const MAX_VISIBLE_ROWS = READONLY_MAX_ROWS
const EDIT_ROW_H       = 32

export interface TableData {
  columns: string[]
  rows:    any[][]
}

export function computeTableLayout(data: TableData): NodeLayout {
  const padding = 4
  const colWidth = 120

  const rows = Array.isArray(data?.rows)    ? data.rows    : []
  const cols = Array.isArray(data?.columns) ? data.columns : []

  const visibleRows = Math.min(rows.length, MAX_VISIBLE_ROWS)
  const hasMore     = rows.length > MAX_VISIBLE_ROWS

  const width = Math.max(240, cols.length * colWidth)

  // 只读态：节点头部 + 列头行 + 数据行
  const readonlyHeight =
    READONLY_HEADER_H +
    READONLY_TABLE_COL_HEADER_H +
    visibleRows * READONLY_TABLE_ROW_H +
    (hasMore ? READONLY_MORE_ROW_H : 0) +
    padding

  // 编辑态
  const editHeight =
    READONLY_HEADER_H +
    READONLY_TABLE_COL_HEADER_H +
    visibleRows * EDIT_ROW_H +
    (hasMore ? 28 : 0) +
    padding

  return {
    readonly: { width, height: readonlyHeight },
    edit:     { width, height: editHeight }
  }
}

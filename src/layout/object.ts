import type { NodeLayout } from '../core/node'
import { isFieldDef } from '../core/node'
import type { FieldType } from '../core/node'
import { READONLY_HEADER_H, READONLY_ROW_H, READONLY_MAX_ROWS, READONLY_MORE_ROW_H } from '../renderer/nodeRenderer'

export interface LayoutContext {
  parentType?: string
  depth?: number
  compact?: boolean
}

/** 编辑态下每种字段类型占用的行高 */
const FIELD_EDIT_HEIGHTS: Record<FieldType, number> = {
  string: 36,
  array:  80,
  object: 80,
  table:  100,
  json:   80,
  custom: 60
}

export function computeObjectLayout(data: Record<string, any>, context?: LayoutContext): NodeLayout {
  const fields     = Object.keys(data)
  const count      = fields.length
  const visible    = Math.min(count, READONLY_MAX_ROWS)
  const hasMore    = count > READONLY_MAX_ROWS
  const padding    = 4

  // 只读态：每行 READONLY_ROW_H，超出显示 "+N more" 行
  const readonlyHeight =
    READONLY_HEADER_H +
    visible * READONLY_ROW_H +
    (hasMore ? READONLY_MORE_ROW_H : 0) +
    padding

  // 编辑态：根据每个字段类型计算高度
  let editContentH = 0
  for (const key of fields) {
    const val       = data[key]
    const fieldType: FieldType = isFieldDef(val) ? val.type : 'string'
    editContentH += FIELD_EDIT_HEIGHTS[fieldType]
  }
  const editHeight = READONLY_HEADER_H + editContentH + fields.length * 8 + 16 + 32

  return {
    readonly: { width: 260, height: readonlyHeight },
    edit:     { width: 320, height: Math.min(editHeight, 520) }
  }
}

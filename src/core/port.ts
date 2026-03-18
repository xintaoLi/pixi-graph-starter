import type { NodeModel } from './node'
import { getNodeTypeConfig } from './nodeTypeRegistry'
import {
  READONLY_HEADER_H,
  READONLY_ROW_H,
  READONLY_MAX_ROWS,
  READONLY_TABLE_COL_HEADER_H,
  READONLY_TABLE_ROW_H
} from '../renderer/nodeRenderer'

// ─── 与 nodeRenderer 共享的布局常量 ──────────────────────────
export const CANVAS_LAYOUT = {
  HEADER_H:          READONLY_HEADER_H,           // 40
  ROW_H:             READONLY_ROW_H,               // 30
  TABLE_COL_HEADER_H: READONLY_TABLE_COL_HEADER_H, // 28
  TABLE_ROW_H:       READONLY_TABLE_ROW_H,         // 26
  MAX_ROWS:          READONLY_MAX_ROWS,             // 5
} as const

// ─── 内部辅助 ────────────────────────────────────────────────

/** 获取节点实际 header 高度（优先注册表配置） */
function resolveHeaderH(node: NodeModel): number {
  if (node.customType) {
    return getNodeTypeConfig(node.customType)?.headerHeight ?? CANVAS_LAYOUT.HEADER_H
  }
  return CANVAS_LAYOUT.HEADER_H
}

/**
 * 获取内容区域的顶部额外偏移：
 * - table 节点内有列头行，数据行从 TABLE_COL_HEADER_H 之后开始
 * - 其他节点：0
 */
function getContentOffsetY(node: NodeModel): number {
  return node.type === 'table' ? CANVAS_LAYOUT.TABLE_COL_HEADER_H : 0
}

/** 获取字段行高（table 与其他类型不同） */
function getRowH(node: NodeModel): number {
  return node.type === 'table' ? CANVAS_LAYOUT.TABLE_ROW_H : CANVAS_LAYOUT.ROW_H
}

/** 字段 key → 行索引 */
function getFieldRowIndex(node: NodeModel, fieldKey: string): number {
  if (node.type === 'object') {
    const keys = Object.keys(node.data ?? {})
    const idx  = keys.indexOf(fieldKey)
    return Math.max(0, idx)
  }
  return Math.max(0, parseInt(fieldKey, 10) || 0)
}

// ─── 端口类型 ────────────────────────────────────────────────

/** 端口类型：node = 整个节点右上角端口；field = 特定字段/行端口 */
export type PortType = 'node' | 'field'

/** 端口引用 */
export interface PortRef {
  nodeId: string
  portType: PortType
  /**
   * 字段级端口的 key：
   * - Object 节点：字段名（如 'username'）
   * - Array 节点：item 索引字符串（如 '0'、'1'）
   * - Table 节点：行索引字符串（如 '0'、'1'）
   */
  fieldKey?: string
}

// ─── 源端口（出口）位置 ──────────────────────────────────────

/**
 * 计算【源端口（出口）】在世界坐标中的位置
 * - node 端口：header 右侧垂直居中
 * - field 端口：对应字段行的右侧中点
 */
export function getPortWorldPosition(node: NodeModel, port: PortRef): { x: number; y: number } {
  const { width } = node.layout.readonly
  const hh         = resolveHeaderH(node)

  if (port.portType === 'node') {
    return { x: node.x + width, y: node.y + hh / 2 }
  }

  const rowIdx     = getFieldRowIndex(node, port.fieldKey ?? '')
  const rowH       = getRowH(node)
  const contentOff = getContentOffsetY(node)

  return {
    x: node.x + width,
    y: node.y + hh + contentOff + rowIdx * rowH + rowH / 2
  }
}

// ─── 目标端口（入口）位置 ────────────────────────────────────

/**
 * 计算【目标端口（入口）】在世界坐标中的最优位置
 *
 * 规则：
 * - 如果源节点在目标节点左侧，连线从目标左侧进入；反之从右侧进入
 * - field 端口：同样按源位置选择左/右入口侧，Y 为对应行中心
 *
 * @param sourceX 源节点出口的 x 坐标（世界坐标），用于判断最优入口侧
 */
export function getTargetPortWorldPosition(
  target: NodeModel,
  port:   PortRef,
  sourceX: number
): { x: number; y: number } {
  const { width } = target.layout.readonly
  const hh         = resolveHeaderH(target)
  // 源在目标中心左边 → 目标左侧入口；否则右侧
  const useLeft    = sourceX < target.x + width / 2

  if (port.portType === 'node') {
    return {
      x: useLeft ? target.x : target.x + width,
      y: target.y + hh / 2
    }
  }

  const rowIdx     = getFieldRowIndex(target, port.fieldKey ?? '')
  const rowH       = getRowH(target)
  const contentOff = getContentOffsetY(target)

  return {
    x: useLeft ? target.x : target.x + width,
    y: target.y + hh + contentOff + rowIdx * rowH + rowH / 2
  }
}

// ─── 字段行端口按钮显示位置 ──────────────────────────────────

/**
 * 获取字段端口 "+" 按钮的显示位置（行顶部边缘，向右偏出节点）
 * 与 getPortWorldPosition 的行中心不同：按钮悬浮在行上边界
 */
export function getFieldPortButtonPosition(
  node: NodeModel,
  fieldKey: string
): { x: number; y: number } {
  const { width } = node.layout.readonly
  const hh         = resolveHeaderH(node)
  const rowIdx     = getFieldRowIndex(node, fieldKey)
  const rowH       = getRowH(node)
  const contentOff = getContentOffsetY(node)

  return {
    x: node.x + width,
    y: node.y + hh + contentOff + rowIdx * rowH
  }
}

// ─── 悬停字段行检测 ──────────────────────────────────────────

/**
 * 根据世界坐标 Y 值判断当前悬停在哪个字段行
 * 返回字段 key（object）或索引字符串（array/table），未命中返回 null
 */
export function getHoveredFieldKey(node: NodeModel, worldY: number): string | null {
  const hh         = resolveHeaderH(node)
  const rowH       = getRowH(node)
  const contentOff = getContentOffsetY(node)
  const maxRows    = CANVAS_LAYOUT.MAX_ROWS

  // 相对于内容区域起始 Y
  const relY = worldY - node.y - hh - contentOff
  if (relY < 0) return null

  const rowIdx = Math.floor(relY / rowH)
  if (rowIdx < 0 || rowIdx >= maxRows) return null

  if (node.type === 'object') {
    const keys = Object.keys(node.data ?? {})
    return keys[rowIdx] ?? null
  }

  if (node.type === 'array') {
    const arr = Array.isArray(node.data) ? node.data : []
    return rowIdx < arr.length ? String(rowIdx) : null
  }

  if (node.type === 'table') {
    const rows = node.data?.rows ?? []
    return rowIdx < rows.length ? String(rowIdx) : null
  }

  return null
}

/** 判断节点类型是否支持字段级端口 */
export function isFieldPortableNode(node: NodeModel): boolean {
  return ['object', 'array', 'table'].includes(node.type)
}

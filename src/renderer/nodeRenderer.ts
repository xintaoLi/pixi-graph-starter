import * as PIXI from 'pixi.js'
import type { NodeModel } from '../core/node'
import { isFieldDef, hasTypedFields } from '../core/node'
import type { FieldType } from '../core/node'
import { resolveIconConfig } from './iconRegistry'
import { resolveNodeTypeConfig } from '../core/nodeTypeRegistry'

// ─── 颜色常量 ────────────────────────────────────────────────
const C = {
  background:    0xffffff,
  selected:      0x3b82f6,
  hover:         0x60a5fa,
  border:        0xe2e8f0,
  headerBg:      0xffffff,
  headerBorder:  0xe2e8f0,
  iconBadge:     0xF8B64F,   // 橙色类型徽章（设计稿规范色）
  nodeName:      0x1e293b,   // 节点名称深色文字

  // 行背景（浅色 = 无下游连线；深色 = 有下游连线）
  keyBg:         0xF0F2FA,
  valueBg:       0xF5F7FA,
  keyBgActive:   0xE6E9F5,
  valueBgActive: 0xEDF0F5,

  // Value 文字颜色
  valueString:   0x0651A5,   // 字符串值（蓝）
  valueNumber:   0x299E56,   // 数值（绿）
  valueMuted:    0x64748b,   // 默认灰色

  // 字段类型小徽章
  fieldBadgeBg:  0xDDE3F0,
  fieldBadgeTxt: 0x64748b,

  keyText:       0x475569,
  divider:       0xe2e8f0,
  tableHeaderBg: 0xf1f5f9,
}

// ─── 尺寸常量 ────────────────────────────────────────────────
export const READONLY_HEADER_H = 40     // 节点头部高度（外部 layout 需同步）
export const READONLY_ROW_H    = 30     // 普通行高
export const READONLY_TABLE_COL_HEADER_H = 28  // 表格列头行高
export const READONLY_TABLE_ROW_H        = 26  // 表格数据行高
export const READONLY_MAX_ROWS = 5      // 最多显示行数
export const READONLY_MORE_ROW_H = 20   // "+N more" 行高

const CORNER_RADIUS        = 8
const BADGE_H              = 24         // 头部徽章高度
const BADGE_RADIUS         = 3
const FIELD_BADGE_W        = 24         // 字段类型小徽章宽
const FIELD_BADGE_H        = 14         // 字段类型小徽章高
const KEY_AREA_W           = 110        // Key 列宽（object/array 行）
const HEADER_RIGHT_RESERVE = 52         // 右侧状态/按钮预留区域

// 端口指示点
const PORT_DOT_R     = 4
const NODE_PORT_R    = 5
const PORT_DOT_COLOR  = 0xe2e8f0
const PORT_DOT_BORDER = 0xaab4c8

// ─── TextStyle ──────────────────────────────────────────────
const STYLE_ICON_BASE: Partial<PIXI.TextStyleOptions> = {
  fontSize: 9,
  fill: 0xffffff,
  fontWeight: 'bold',
  fontFamily: 'system-ui, sans-serif'
}

const STYLE_LABEL = new PIXI.TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize:   12,
  fill:       C.nodeName,
  fontWeight: '600'
})

const STYLE_KEY = new PIXI.TextStyle({
  fontFamily: 'ui-monospace, monospace',
  fontSize:   10,
  fill:       C.keyText
})

const STYLE_FIELD_BADGE = new PIXI.TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize:   9,
  fill:       C.fieldBadgeTxt,
  fontWeight: '600'
})

const STYLE_VALUE_STRING = new PIXI.TextStyle({
  fontFamily: 'ui-monospace, monospace',
  fontSize:   10,
  fill:       C.valueString
})

const STYLE_VALUE_NUMBER = new PIXI.TextStyle({
  fontFamily: 'ui-monospace, monospace',
  fontSize:   10,
  fill:       C.valueNumber
})

const STYLE_VALUE_DEFAULT = new PIXI.TextStyle({
  fontFamily: 'ui-monospace, monospace',
  fontSize:   10,
  fill:       C.valueMuted
})

const STYLE_TABLE_HEADER = new PIXI.TextStyle({
  fontFamily: 'ui-monospace, monospace',
  fontSize:   10,
  fill:       0x475569,
  fontWeight: '600'
})

const STYLE_MORE = new PIXI.TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize:   9,
  fill:       0x94a3b8,
  fontStyle:  'italic'
})

const STYLE_PREVIEW = new PIXI.TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize:   10,
  fill:       C.valueMuted
})

// ─── 字段类型缩写 ─────────────────────────────────────────────
const FIELD_TYPE_SHORT: Record<FieldType, string> = {
  string: 'Str',
  array:  'Arr',
  object: 'Obj',
  table:  'Tbl',
  json:   'JSON',
  custom: 'C'
}

// ─── 节点容器零件 ─────────────────────────────────────────────
interface NodeParts {
  bg:       PIXI.Graphics
  header:   PIXI.Graphics
  icon:     PIXI.Text
  label:    PIXI.Text
  content:  PIXI.Container
  nodePort: PIXI.Graphics
}

const graphicsMap = new Map<string, PIXI.Container>()
const partsMap    = new WeakMap<PIXI.Container, NodeParts>()

// ─── 公开 API ────────────────────────────────────────────────

export function renderNode(node: NodeModel, container: PIXI.Container): PIXI.Container {
  const existing = graphicsMap.get(node.id)
  if (existing) {
    updateNode(node, existing)
    return existing
  }
  const nc = buildNodeContainer(node)
  container.addChild(nc)
  graphicsMap.set(node.id, nc)
  return nc
}

export function refreshNode(node: NodeModel) {
  const nc = graphicsMap.get(node.id)
  if (nc) updateNode(node, nc)
}

export function removeNode(id: string) {
  const nc = graphicsMap.get(id)
  if (nc) {
    nc.parent?.removeChild(nc)
    nc.destroy({ children: true })
    graphicsMap.delete(id)
    partsMap.delete(nc)
  }
}

export function clearAllNodes() {
  graphicsMap.forEach(nc => {
    nc.destroy({ children: true })
    partsMap.delete(nc)
  })
  graphicsMap.clear()
}

// ─── 构建节点容器 ─────────────────────────────────────────────

function buildNodeContainer(node: NodeModel): PIXI.Container {
  const nc = new PIXI.Container()
  nc.x = node.x
  nc.y = node.y

  const bg       = new PIXI.Graphics()
  const header   = new PIXI.Graphics()
  const icon     = buildIconText(node)
  const label    = new PIXI.Text({ text: getHeaderLabel(node), style: STYLE_LABEL })
  const content  = new PIXI.Container()
  const nodePort = new PIXI.Graphics()

  content.y = getHeaderH(node)
  nc.addChild(bg, header, icon, label, content, nodePort)

  const parts: NodeParts = { bg, header, icon, label, content, nodePort }
  partsMap.set(nc, parts)

  drawBackground(node, bg, header, icon.text)
  positionHeader(node, icon, label)
  buildContent(node, content)
  drawNodePort(node, nodePort)

  return nc
}

function updateNode(node: NodeModel, nc: PIXI.Container) {
  nc.x = node.x
  nc.y = node.y

  const parts = partsMap.get(nc)
  if (!parts) return

  const { bg, header, icon, label, content, nodePort } = parts

  const newIconStyle = buildIconStyle(node)
  icon.style = newIconStyle
  icon.text  = getIconChar(node)

  drawBackground(node, bg, header, icon.text)
  positionHeader(node, icon, label)
  label.text = getHeaderLabel(node)

  content.y = getHeaderH(node)
  content.removeChildren().forEach(c => (c as PIXI.Container).destroy({ children: true }))
  buildContent(node, content)

  drawNodePort(node, nodePort)
}

// ─── 节点级端口（右上角小圆点）────────────────────────────────

function drawNodePort(node: NodeModel, g: PIXI.Graphics) {
  const { width } = node.layout.readonly
  g.clear()
  g.circle(width, 0, NODE_PORT_R)
  g.fill({ color: 0xffffff })
  g.circle(width, 0, NODE_PORT_R)
  g.stroke({ color: PORT_DOT_BORDER, width: 1.5 })
}

function getHeaderH(node: NodeModel): number {
  return resolveNodeTypeConfig(node)?.headerHeight ?? READONLY_HEADER_H
}

// ─── Icon 辅助 ───────────────────────────────────────────────

function buildIconText(node: NodeModel): PIXI.Text {
  return new PIXI.Text({
    text:  getIconChar(node),
    style: buildIconStyle(node)
  })
}

function buildIconStyle(node: NodeModel): PIXI.TextStyle {
  const iconCfg  = resolveIconConfig(node)
  const typeCfg  = resolveNodeTypeConfig(node)
  const fontFamily = iconCfg?.fontFamily
    ?? typeCfg?.fontIcon?.fontFamily
    ?? 'system-ui, sans-serif'
  return new PIXI.TextStyle({ ...STYLE_ICON_BASE, fontFamily })
}

function getIconChar(node: NodeModel): string {
  const fromIconRegistry = resolveIconConfig(node)?.icon
  if (fromIconRegistry) return fromIconRegistry
  return resolveNodeTypeConfig(node)?.fontIcon?.icon ?? ''
}

/** 根据文字长度估算徽章宽度（9px bold 字体，约 6.5px/字符） */
function getBadgeWidth(text: string): number {
  return Math.max(28, Math.ceil(text.length * 6.5) + 10)
}

// ─── 背景 / header 绘制 ──────────────────────────────────────

function drawBackground(
  node: NodeModel,
  bg: PIXI.Graphics,
  header: PIXI.Graphics,
  iconText: string
) {
  const { width, height } = node.layout.readonly
  const typeCfg     = resolveNodeTypeConfig(node)
  const borderColor = node.state.selected ? C.selected : node.state.hover ? C.hover : C.border
  const borderW     = node.state.selected ? 2 : 1
  const hh          = getHeaderH(node)
  const badgeColor  = node.meta?.headerColor ?? typeCfg?.headerBackground ?? C.iconBadge
  const badgeW      = getBadgeWidth(iconText)
  const badgePadY   = (hh - BADGE_H) / 2

  // 卡片白底
  bg.clear()
  bg.roundRect(0, 0, width, height, CORNER_RADIUS)
  bg.fill({ color: C.background })
  bg.roundRect(0, 0, width, height, CORNER_RADIUS)
  bg.stroke({ color: borderColor, width: borderW })

  // Header 区域：白底 + 底部分割线
  header.clear()
  header.roundRect(0, 0, width, hh, CORNER_RADIUS)
  header.fill({ color: C.headerBg })
  header.rect(0, CORNER_RADIUS, width, hh - CORNER_RADIUS)
  header.fill({ color: C.headerBg })
  // 底部分割线
  header.rect(0, hh - 1, width, 1)
  header.fill({ color: C.headerBorder })

  // 橙色类型徽章
  if (iconText) {
    header.roundRect(8, badgePadY, badgeW, BADGE_H, BADGE_RADIUS)
    header.fill({ color: badgeColor })
  }
}

// ─── 头部 icon / label 定位 ──────────────────────────────────

function positionHeader(node: NodeModel, icon: PIXI.Text, label: PIXI.Text) {
  const hh       = getHeaderH(node)
  const iconText = icon.text
  const { width } = node.layout.readonly
  const badgeW   = getBadgeWidth(iconText)
  const badgePadY = (hh - BADGE_H) / 2

  if (iconText) {
    // 在徽章内居中
    icon.x = 8 + (badgeW - icon.width) / 2
    icon.y = badgePadY + (BADGE_H - icon.height) / 2
    label.x = 8 + badgeW + 8
  } else {
    icon.x  = -999
    label.x = 12
  }

  label.y = (hh - label.height) / 2

  // 防止节点名超出右侧预留区域
  const maxLabelW = width - HEADER_RIGHT_RESERVE - label.x - 4
  label.style.wordWrap = false
  if (label.width > maxLabelW) {
    const ratio = maxLabelW / label.width
    label.scale.x = Math.max(0.5, ratio)
  } else {
    label.scale.x = 1
  }
}

// ─── 内容区域 ────────────────────────────────────────────────

function buildContent(node: NodeModel, layer: PIXI.Container) {
  const typeCfg = resolveNodeTypeConfig(node)

  if (typeCfg?.heightMode === 'full') {
    buildFullModePlaceholder(node, layer)
    return
  }

  if (node.type === 'object' && hasTypedFields(node.data)) {
    buildTypedFieldRows(node, layer)
  } else if (node.type === 'array') {
    buildArrayRows(node, layer)
  } else if (node.type === 'table') {
    buildTableRows(node, layer)
  } else {
    buildSimplePreview(node, layer)
  }
}

function buildFullModePlaceholder(node: NodeModel, layer: PIXI.Container) {
  const { width, height } = node.layout.readonly
  const hh = getHeaderH(node)
  const contentH = height - hh
  const ph = new PIXI.Graphics()
  ph.rect(0, 0, width - 2, contentH - 2)
  ph.fill({ color: 0xf8fafc })
  layer.addChild(ph)
}

// ─── Object 节点：字段行 ─────────────────────────────────────

function buildTypedFieldRows(node: NodeModel, layer: PIXI.Container) {
  const data    = node.data as Record<string, any>
  const { width } = node.layout.readonly
  const entries = Object.entries(data).slice(0, READONLY_MAX_ROWS)
  const total   = Object.keys(data).length
  const hasMore = total > READONLY_MAX_ROWS

  entries.forEach(([key, fieldDef], idx) => {
    const row = new PIXI.Container()
    row.y = idx * READONLY_ROW_H

    const fType: FieldType = isFieldDef(fieldDef) ? fieldDef.type : 'string'
    const fValue = isFieldDef(fieldDef) ? fieldDef.value : fieldDef

    // 行背景：左侧 Key 区、右侧 Value 区
    const rowBg = new PIXI.Graphics()
    rowBg.rect(0, 0, KEY_AREA_W, READONLY_ROW_H)
    rowBg.fill({ color: C.keyBg })
    rowBg.rect(KEY_AREA_W, 0, width - KEY_AREA_W, READONLY_ROW_H)
    rowBg.fill({ color: C.valueBg })
    // 行间分割线
    if (idx > 0) {
      rowBg.rect(0, 0, width, 1)
      rowBg.fill({ color: C.divider })
    }
    row.addChild(rowBg)

    // 字段类型小徽章
    const badgePadY = (READONLY_ROW_H - FIELD_BADGE_H) / 2
    const smBadge = new PIXI.Graphics()
    smBadge.roundRect(5, badgePadY, FIELD_BADGE_W, FIELD_BADGE_H, 2)
    smBadge.fill({ color: C.fieldBadgeBg })
    row.addChild(smBadge)

    const badgeLbl = FIELD_TYPE_SHORT[fType]
    const smBadgeTxt = new PIXI.Text({ text: badgeLbl, style: STYLE_FIELD_BADGE })
    smBadgeTxt.x = 5 + (FIELD_BADGE_W - smBadgeTxt.width) / 2
    smBadgeTxt.y = badgePadY + (FIELD_BADGE_H - smBadgeTxt.height) / 2
    row.addChild(smBadgeTxt)

    // Key 文字
    const keyTxt = new PIXI.Text({ text: truncate(key, 8), style: STYLE_KEY })
    keyTxt.x = 5 + FIELD_BADGE_W + 4
    keyTxt.y = (READONLY_ROW_H - keyTxt.height) / 2
    row.addChild(keyTxt)

    // Value 文字
    const valueStr   = getFieldValueStr(fType, fValue)
    const valueStyle = getValueStyle(fType, fValue)
    const valueTxt   = new PIXI.Text({ text: valueStr, style: valueStyle })
    valueTxt.x = KEY_AREA_W + 8
    valueTxt.y = (READONLY_ROW_H - valueTxt.height) / 2
    row.addChild(valueTxt)

    // 右侧端口指示点
    row.addChild(makePortDot(width - 8, READONLY_ROW_H / 2))

    layer.addChild(row)
  })

  if (hasMore) {
    layer.addChild(makeMoreRow(entries.length * READONLY_ROW_H, total - READONLY_MAX_ROWS, 'fields'))
  }
}

// ─── Array 节点：条目行 ──────────────────────────────────────

function buildArrayRows(node: NodeModel, layer: PIXI.Container) {
  const arr     = Array.isArray(node.data) ? node.data : []
  const { width } = node.layout.readonly
  const visible = arr.slice(0, READONLY_MAX_ROWS)
  const hasMore = arr.length > READONLY_MAX_ROWS

  visible.forEach((item, idx) => {
    const row = new PIXI.Container()
    row.y = idx * READONLY_ROW_H

    // 行背景
    const rowBg = new PIXI.Graphics()
    rowBg.rect(0, 0, width, READONLY_ROW_H)
    rowBg.fill({ color: 0xffffff })
    if (idx > 0) {
      rowBg.rect(0, 0, width, 1)
      rowBg.fill({ color: C.divider })
    }
    row.addChild(rowBg)

    // 字段类型小徽章
    const itemType  = inferItemFieldType(item)
    const badgePadY = (READONLY_ROW_H - FIELD_BADGE_H) / 2
    const smBadge   = new PIXI.Graphics()
    smBadge.roundRect(5, badgePadY, FIELD_BADGE_W, FIELD_BADGE_H, 2)
    smBadge.fill({ color: C.fieldBadgeBg })
    row.addChild(smBadge)

    const smBadgeTxt = new PIXI.Text({ text: FIELD_TYPE_SHORT[itemType], style: STYLE_FIELD_BADGE })
    smBadgeTxt.x = 5 + (FIELD_BADGE_W - smBadgeTxt.width) / 2
    smBadgeTxt.y = badgePadY + (FIELD_BADGE_H - smBadgeTxt.height) / 2
    row.addChild(smBadgeTxt)

    // 索引数字
    const idxTxt = new PIXI.Text({ text: String(idx), style: STYLE_KEY })
    idxTxt.x = 5 + FIELD_BADGE_W + 5
    idxTxt.y = (READONLY_ROW_H - idxTxt.height) / 2
    row.addChild(idxTxt)

    // 值文字
    const valStr   = truncate(
      typeof item === 'object' ? JSON.stringify(item) : String(item ?? ''), 20
    )
    const valStyle = getValueStyleFromRaw(item)
    const valTxt   = new PIXI.Text({ text: valStr, style: valStyle })
    valTxt.x = 5 + FIELD_BADGE_W + 22
    valTxt.y = (READONLY_ROW_H - valTxt.height) / 2
    row.addChild(valTxt)

    // 右侧端口指示点
    row.addChild(makePortDot(width - 8, READONLY_ROW_H / 2))

    layer.addChild(row)
  })

  if (hasMore) {
    layer.addChild(makeMoreRow(visible.length * READONLY_ROW_H, arr.length - READONLY_MAX_ROWS, 'items'))
  }
}

// ─── Table 节点：列头 + 数据行 ──────────────────────────────

function buildTableRows(node: NodeModel, layer: PIXI.Container) {
  const { width } = node.layout.readonly
  const columns: string[]  = node.data?.columns ?? []
  const rows:    any[][]   = node.data?.rows    ?? []
  const visible = rows.slice(0, READONLY_MAX_ROWS)
  const colW    = columns.length > 0
    ? Math.max(60, Math.floor((width - 16) / columns.length))
    : width - 16

  // 列头行
  const colHeaderBg = new PIXI.Graphics()
  colHeaderBg.rect(0, 0, width, READONLY_TABLE_COL_HEADER_H)
  colHeaderBg.fill({ color: C.tableHeaderBg })
  colHeaderBg.rect(0, READONLY_TABLE_COL_HEADER_H - 1, width, 1)
  colHeaderBg.fill({ color: C.divider })
  layer.addChild(colHeaderBg)

  columns.forEach((col, ci) => {
    const colX = 8 + ci * colW

    const colTxt = new PIXI.Text({ text: truncate(col, 9), style: STYLE_TABLE_HEADER })
    colTxt.x = colX
    colTxt.y = (READONLY_TABLE_COL_HEADER_H - colTxt.height) / 2
    layer.addChild(colTxt)

    // 列类型小徽章（Str）
    const badgeX  = colX + colTxt.width + 4
    const badgePY = (READONLY_TABLE_COL_HEADER_H - FIELD_BADGE_H) / 2
    if (badgeX + FIELD_BADGE_W < colX + colW - 2) {
      const cBadge = new PIXI.Graphics()
      cBadge.roundRect(badgeX, badgePY, FIELD_BADGE_W, FIELD_BADGE_H, 2)
      cBadge.fill({ color: C.fieldBadgeBg })
      layer.addChild(cBadge)

      const cBadgeTxt = new PIXI.Text({ text: 'Str', style: STYLE_FIELD_BADGE })
      cBadgeTxt.x = badgeX + (FIELD_BADGE_W - cBadgeTxt.width) / 2
      cBadgeTxt.y = badgePY + (FIELD_BADGE_H - cBadgeTxt.height) / 2
      layer.addChild(cBadgeTxt)
    }
  })

  // 数据行
  visible.forEach((row, idx) => {
    const rowY = READONLY_TABLE_COL_HEADER_H + idx * READONLY_TABLE_ROW_H

    const rowBg = new PIXI.Graphics()
    rowBg.rect(0, rowY, width, READONLY_TABLE_ROW_H)
    rowBg.fill({ color: 0xffffff })
    rowBg.rect(0, rowY + READONLY_TABLE_ROW_H - 1, width, 1)
    rowBg.fill({ color: C.divider })
    layer.addChild(rowBg)

    columns.forEach((_, ci) => {
      const cell    = String(row[ci] ?? '')
      const cellTxt = new PIXI.Text({ text: truncate(cell, 10), style: STYLE_VALUE_DEFAULT })
      cellTxt.x = 8 + ci * colW
      cellTxt.y = rowY + (READONLY_TABLE_ROW_H - cellTxt.height) / 2
      layer.addChild(cellTxt)
    })

    // 右侧端口指示点
    layer.addChild(makePortDot(width - 8, rowY + READONLY_TABLE_ROW_H / 2))
  })

  if (rows.length > READONLY_MAX_ROWS) {
    const moreY = READONLY_TABLE_COL_HEADER_H + visible.length * READONLY_TABLE_ROW_H
    const moreTxt = new PIXI.Text({
      text: `+${rows.length - READONLY_MAX_ROWS} more rows`,
      style: STYLE_MORE
    })
    moreTxt.x = 8
    moreTxt.y = moreY + 4
    layer.addChild(moreTxt)
  }
}

// ─── 简单预览（Text / JSON 等）──────────────────────────────

function buildSimplePreview(node: NodeModel, layer: PIXI.Container) {
  const { width } = node.layout.readonly
  const txt = new PIXI.Text({ text: getSimplePreview(node), style: STYLE_PREVIEW })
  txt.x = 10
  txt.y = 8
  txt.style.wordWrap      = true
  txt.style.wordWrapWidth = width - 20
  layer.addChild(txt)
}

// ─── 辅助：端口指示点 ────────────────────────────────────────

function makePortDot(cx: number, cy: number): PIXI.Graphics {
  const g = new PIXI.Graphics()
  g.circle(cx, cy, PORT_DOT_R - 1)
  g.fill({ color: PORT_DOT_COLOR })
  g.circle(cx, cy, PORT_DOT_R - 1)
  g.stroke({ color: PORT_DOT_BORDER, width: 1 })
  return g
}

function makeMoreRow(y: number, count: number, unit: string): PIXI.Container {
  const c = new PIXI.Container()
  c.y = y
  const t = new PIXI.Text({
    text:  `+${count} more ${unit}`,
    style: STYLE_MORE
  })
  t.x = 8
  t.y = (READONLY_MORE_ROW_H - t.height) / 2
  c.addChild(t)
  return c
}

// ─── 辅助：值颜色 / 样式 ─────────────────────────────────────

function getValueStyle(fieldType: FieldType, value: any): PIXI.TextStyle {
  if (fieldType === 'string') return isNumericStr(value) ? STYLE_VALUE_NUMBER : STYLE_VALUE_STRING
  if (typeof value === 'number') return STYLE_VALUE_NUMBER
  return STYLE_VALUE_DEFAULT
}

function getValueStyleFromRaw(value: any): PIXI.TextStyle {
  if (typeof value === 'number') return STYLE_VALUE_NUMBER
  if (typeof value === 'string') return isNumericStr(value) ? STYLE_VALUE_NUMBER : STYLE_VALUE_STRING
  return STYLE_VALUE_DEFAULT
}

function isNumericStr(v: any): boolean {
  if (typeof v === 'number') return true
  if (typeof v !== 'string' || v.trim() === '') return false
  return !isNaN(Number(v))
}

function inferItemFieldType(item: any): FieldType {
  if (Array.isArray(item)) return 'array'
  if (item !== null && typeof item === 'object') return 'object'
  return 'string'
}

// ─── 辅助：字符串预览 ────────────────────────────────────────

function getFieldValueStr(type: FieldType, value: any): string {
  try {
    switch (type) {
      case 'string': return truncate(String(value ?? ''), 18)
      case 'array': {
        const arr = Array.isArray(value) ? value : []
        return arr.length === 0 ? '[]' : `[${arr.length} items]`
      }
      case 'object': {
        const keys = Object.keys(value ?? {})
        return keys.length === 0 ? '{}' : `{${keys.slice(0, 2).join(', ')}…}`
      }
      case 'table': {
        const c = (value?.columns ?? []).length
        const r = (value?.rows    ?? []).length
        return `${c} cols × ${r} rows`
      }
      case 'json':   return truncate(JSON.stringify(value), 16)
      case 'custom': return truncate(String(value ?? ''), 14)
    }
  } catch { return '–' }
}

function getHeaderLabel(node: NodeModel): string {
  if (node.meta?.label) return node.meta.label
  const labels: Record<string, string> = {
    object: 'Object', array: 'Array', table: 'Table', json: 'JSON', text: 'Text'
  }
  return labels[node.type] ?? node.type
}

function getSimplePreview(node: NodeModel): string {
  try {
    const d = node.data
    if (node.type === 'text')   return truncate(typeof d === 'string' ? d : d?.text ?? '', 60)
    if (node.type === 'json')   return truncate(JSON.stringify(d), 50)
    if (node.type === 'object') return Object.keys(d ?? {}).slice(0, 4).join(', ')
    if (node.type === 'array')  return `${(d ?? []).length} items`
    if (node.type === 'table') {
      const c = (d?.columns ?? []).length
      const r = (d?.rows    ?? []).length
      return `${c} cols × ${r} rows`
    }
    return ''
  } catch { return '' }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

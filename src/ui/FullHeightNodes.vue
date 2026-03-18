<template>
  <template v-for="node in fullNodes" :key="node.id">
    <div
      class="full-node-content"
      :ref="el => registerEl(node.id, el as HTMLElement | null)"
      :style="getContentStyle(node)"
    >
      <!-- Object 节点：字段行 -->
      <template v-if="node.type === 'object'">
        <div
          v-for="[key, val] in getObjectEntries(node)"
          :key="key"
          class="field-row"
        >
          <div class="key-area">
            <span class="field-badge" :style="getBadgeStyle(getFieldType(val))">
              {{ typeShort(getFieldType(val)) }}
            </span>
            <span class="field-key">{{ key }}</span>
          </div>
          <div class="value-area">
            <span class="field-val" :class="getValueClass(getFieldType(val), getFieldRawVal(val))">
              {{ previewValue(getFieldRawVal(val)) }}
            </span>
          </div>
        </div>
      </template>

      <!-- Array 节点：索引行 -->
      <template v-else-if="node.type === 'array'">
        <div
          v-for="(item, idx) in getArrayItems(node)"
          :key="idx"
          class="arr-row"
        >
          <span class="field-badge badge-str">Str</span>
          <span class="arr-idx">{{ idx }}</span>
          <span class="field-val" :class="getRawValueClass(item)">
            {{ previewValue(item) }}
          </span>
        </div>
      </template>

      <!-- Table 节点：表格 -->
      <template v-else-if="node.type === 'table'">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="col in getTableColumns(node)" :key="col">
                <span class="th-name">{{ col }}</span>
                <span class="field-badge badge-str">Str</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in getTableRows(node)" :key="ri">
              <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <!-- JSON 节点：语法高亮 -->
      <template v-else-if="node.type === 'json'">
        <pre class="json-pre" v-html="highlightJson(node.data)" />
      </template>

      <!-- Text / String 节点 -->
      <template v-else>
        <p class="text-content">{{ node.data?.text ?? String(node.data ?? '') }}</p>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, watch, nextTick, onUnmounted, ref } from 'vue'
import { store } from '../core/store'
import { worldToScreen } from '../core/viewport'
import { resolveNodeTypeConfig } from '../core/nodeTypeRegistry'
import { invalidateLayoutCache } from '../layout/index'
import { refreshNode } from '../renderer/nodeRenderer'
import { updateNodeInIndex } from '../interaction/hitTest'
import { isFieldDef } from '../core/node'
import type { NodeModel, FieldType } from '../core/node'

const DEFAULT_HEADER_H = 40
const CORNER_RADIUS    = 8

// ─── full 模式节点列表 ────────────────────────────────────────
const fullNodes = computed(() =>
  Array.from(store.nodes.values()).filter(n => {
    const cfg = resolveNodeTypeConfig(n)
    return cfg?.heightMode === 'full'
  })
)

// ─── HTML 元素 ref 映射 ───────────────────────────────────────
const elMap = new Map<string, HTMLElement>()

function registerEl(nodeId: string, el: HTMLElement | null) {
  if (el) {
    elMap.set(nodeId, el)
    nextTick(() => syncHeight(nodeId))
  } else {
    elMap.delete(nodeId)
  }
}

// ─── 高度同步 ─────────────────────────────────────────────────
function syncHeight(nodeId: string) {
  const el   = elMap.get(nodeId)
  const node = store.nodes.get(nodeId)
  if (!el || !node) return

  const cfg     = resolveNodeTypeConfig(node)
  const hh      = cfg?.headerHeight ?? DEFAULT_HEADER_H
  const contentH = el.offsetHeight
  const totalH   = hh + contentH

  if (Math.abs(totalH - node.layout.readonly.height) > 2) {
    invalidateLayoutCache(node)
    node.layout.readonly.height = totalH
    node.layout.edit.height     = totalH
    refreshNode(node)
    updateNodeInIndex(node)
  }
}

watch(fullNodes, async () => {
  await nextTick()
  fullNodes.value.forEach(n => syncHeight(n.id))
}, { deep: false })

// ─── 定位样式 ─────────────────────────────────────────────────
function getContentStyle(node: NodeModel): Record<string, string> {
  const { width } = node.layout.readonly
  const cfg = resolveNodeTypeConfig(node)
  const hh  = cfg?.headerHeight ?? DEFAULT_HEADER_H
  const z   = store.viewport.zoom
  const { x, y } = worldToScreen(node.x, node.y + hh)

  return {
    left:                  `${x}px`,
    top:                   `${y}px`,
    width:                 `${width * z}px`,
    fontSize:              `${Math.max(9, 11 * z)}px`,
    borderBottomLeftRadius:  `${CORNER_RADIUS * z}px`,
    borderBottomRightRadius: `${CORNER_RADIUS * z}px`
  }
}

// ─── 数据提取辅助 ─────────────────────────────────────────────
function getObjectEntries(node: NodeModel): [string, any][] {
  return Object.entries(node.data ?? {})
}

function getArrayItems(node: NodeModel): any[] {
  return Array.isArray(node.data) ? node.data : []
}

function getTableColumns(node: NodeModel): string[] {
  return node.data?.columns ?? []
}

function getTableRows(node: NodeModel): any[][] {
  return node.data?.rows ?? []
}

function getFieldType(val: any): FieldType {
  return isFieldDef(val) ? val.type : 'string'
}

function getFieldRawVal(val: any): any {
  return isFieldDef(val) ? val.value : val
}

// ─── JSON 语法高亮 ────────────────────────────────────────────
function highlightJson(data: any): string {
  try {
    const json = JSON.stringify(data, null, 2)
    return json
      // key
      .replace(/"([\w\s\-_\.]+)"(\s*):/g, '<span class="jk">"$1"</span>$2:')
      // string value
      .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="jv">"$1"</span>'.replace(/<span class="jv">"(".*?")"<\/span>/, '<span class="jv">$1</span>'))
      // number value
      .replace(/:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, ': <span class="jn">$1</span>')
      // boolean
      .replace(/:\s*(true|false)/g, ': <span class="jb">$1</span>')
      // null
      .replace(/:\s*(null)/g, ': <span class="jnull">$1</span>')
  } catch {
    return String(data)
  }
}

// ─── 值预览 ──────────────────────────────────────────────────
function previewValue(val: any): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') {
    try { return JSON.stringify(val).slice(0, 80) } catch { return '[Object]' }
  }
  return String(val)
}

// ─── 值颜色 class ────────────────────────────────────────────
function getValueClass(fieldType: FieldType, value: any): string {
  if (fieldType === 'string') return isNumericLike(value) ? 'val-num' : 'val-str'
  if (typeof value === 'number') return 'val-num'
  return 'val-muted'
}

function getRawValueClass(value: any): string {
  if (typeof value === 'number') return 'val-num'
  if (typeof value === 'string') return isNumericLike(value) ? 'val-num' : 'val-str'
  return 'val-muted'
}

function isNumericLike(v: any): boolean {
  if (typeof v === 'number') return true
  if (typeof v !== 'string' || v.trim() === '') return false
  return !isNaN(Number(v))
}

// ─── 字段类型徽章 ─────────────────────────────────────────────
const TYPE_SHORT: Record<FieldType, string> = {
  string: 'Str', array: 'Arr', object: 'Obj', table: 'Tbl', json: 'JSON', custom: 'C'
}

function typeShort(t: FieldType): string {
  return TYPE_SHORT[t] ?? t
}

const BADGE_COLORS: Record<FieldType, string> = {
  string: '#DDE3F0', array: '#DDE3F0', object: '#DDE3F0',
  table:  '#DDE3F0', json:  '#DDE3F0', custom: '#DDE3F0'
}

function getBadgeStyle(t: FieldType): Record<string, string> {
  return { background: BADGE_COLORS[t] ?? '#DDE3F0' }
}
</script>

<style scoped>
.full-node-content {
  position: absolute;
  background: #fff;
  overflow: hidden;
  pointer-events: none;
  box-sizing: border-box;
  border-left:   1px solid #e2e8f0;
  border-right:  1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  max-height: 640px;
  overflow-y: auto;
  scrollbar-width: none; /* 默认隐藏滚动条 */
}

.full-node-content:hover {
  scrollbar-width: thin;
  scrollbar-color: #c7d2fe transparent;
}

/* ── Object 行 ──────────────────────────────── */
.field-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #e2e8f0;
  min-height: 30px;
}

.field-row:last-child {
  border-bottom: none;
}

.key-area {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: #F0F2FA;
  width: 110px;
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
}

.value-area {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: #F5F7FA;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.field-key {
  font-family: ui-monospace, monospace;
  font-size: 0.88em;
  color: #475569;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.field-val {
  font-family: ui-monospace, monospace;
  font-size: 0.88em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Array 行 ───────────────────────────────── */
.arr-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}

.arr-row:last-child {
  border-bottom: none;
}

.arr-idx {
  font-family: ui-monospace, monospace;
  font-size: 0.88em;
  color: #94a3b8;
  min-width: 16px;
}

/* ── 通用徽章 ───────────────────────────────── */
.field-badge {
  flex-shrink: 0;
  font-size: 0.75em;
  color: #64748b;
  border-radius: 2px;
  padding: 1px 3px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.badge-str {
  background: #DDE3F0;
}

/* ── 值颜色 ─────────────────────────────────── */
.val-str  { color: #0651A5; }
.val-num  { color: #299E56; }
.val-muted { color: #64748b; }

/* ── Table ──────────────────────────────────── */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-family: ui-monospace, monospace;
  font-size: 0.88em;
}

.data-table th {
  background: #f1f5f9;
  color: #475569;
  font-weight: 600;
  padding: 5px 8px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.data-table th .th-name {
  margin-right: 4px;
}

.data-table td {
  padding: 4px 8px;
  color: #475569;
  border-bottom: 1px solid #f1f5f9;
  white-space: nowrap;
}

.data-table tr:last-child td {
  border-bottom: none;
}

/* ── JSON ───────────────────────────────────── */
.json-pre {
  margin: 0;
  padding: 8px 12px;
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
  color: #334155;
  white-space: pre;
  overflow-x: auto;
  scrollbar-width: none;
  line-height: 1.6;
}

.json-pre:hover {
  scrollbar-width: thin;
  scrollbar-color: #c7d2fe transparent;
}

/* JSON 语法高亮 */
:deep(.jk)    { color: #C0392B; }   /* key */
:deep(.jv)    { color: #0651A5; }   /* string value */
:deep(.jn)    { color: #299E56; }   /* number */
:deep(.jb)    { color: #8B5CF6; }   /* boolean */
:deep(.jnull) { color: #94a3b8; }   /* null */

/* ── Text ───────────────────────────────────── */
.text-content {
  margin: 0;
  padding: 8px 12px;
  color: #475569;
  font-family: ui-monospace, monospace;
  font-size: 0.88em;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>

<template>
  <div class="node-editor">
    <!-- Header -->
    <div class="editor-header">
      <span class="type-badge" :class="`type-${node.type}`">{{ typeLabel }}</span>
      <span class="node-id">{{ node.id.slice(0, 8) }}</span>
      <button class="close-btn" @click="$emit('close')">✕</button>
    </div>

    <div class="editor-body">
      <!-- ── Object 节点：支持 FieldDef 字段级编辑 ── -->
      <template v-if="node.type === 'object'">
        <div
          v-for="[key, fieldDef] in objectEntries"
          :key="key"
          class="typed-field"
        >
          <!-- 字段头 -->
          <div class="field-head">
            <span class="field-key">{{ key }}</span>
            <!-- 类型选择器 -->
            <select
              class="type-select"
              :class="`ft-${getFieldType(fieldDef)}`"
              :value="getFieldType(fieldDef)"
              @change="changeFieldType(key, ($event.target as HTMLSelectElement).value as FieldType)"
            >
              <option v-for="ft in FIELD_TYPES" :key="ft.value" :value="ft.value">
                {{ ft.label }}
              </option>
            </select>
            <button class="field-remove-btn" @click="removeField(key)" title="删除字段">✕</button>
          </div>

          <!-- 字段值编辑器（根据 type 切换） -->
          <div class="field-value-editor">
            <!-- string -->
            <input
              v-if="getFieldType(fieldDef) === 'string'"
              class="fv-input"
              :value="getFieldValue(fieldDef)"
              @input="updateFieldValue(key, ($event.target as HTMLInputElement).value)"
              placeholder="string value"
            />

            <!-- array -->
            <template v-else-if="getFieldType(fieldDef) === 'array'">
              <div
                v-for="(item, idx) in getFieldArrayValue(fieldDef)"
                :key="idx"
                class="arr-item-row"
              >
                <span class="arr-idx">[{{ idx }}]</span>
                <input
                  class="fv-input fv-input--sm"
                  :value="String(item)"
                  @input="updateArrayItem(key, idx, ($event.target as HTMLInputElement).value)"
                />
                <button class="arr-remove" @click="removeArrayItem(key, idx)">−</button>
              </div>
              <button class="arr-add-btn" @click="addArrayItem(key)">+ 添加项</button>
            </template>

            <!-- object -->
            <template v-else-if="getFieldType(fieldDef) === 'object'">
              <textarea
                class="fv-textarea fv-mono"
                :value="toJsonString(getFieldValue(fieldDef))"
                @input="updateFieldValueJson(key, ($event.target as HTMLTextAreaElement).value)"
                rows="3"
                placeholder="{}"
              />
              <span v-if="jsonErrors[key]" class="json-err">{{ jsonErrors[key] }}</span>
            </template>

            <!-- table -->
            <template v-else-if="getFieldType(fieldDef) === 'table'">
              <div class="table-preview">
                <span class="table-stat">
                  {{ (getFieldValue(fieldDef)?.columns ?? []).length }} 列 ×
                  {{ (getFieldValue(fieldDef)?.rows ?? []).length }} 行
                </span>
                <textarea
                  class="fv-textarea fv-mono"
                  :value="toJsonString(getFieldValue(fieldDef))"
                  @input="updateFieldValueJson(key, ($event.target as HTMLTextAreaElement).value)"
                  rows="4"
                  placeholder='{"columns":[],"rows":[]}'
                />
              </div>
              <span v-if="jsonErrors[key]" class="json-err">{{ jsonErrors[key] }}</span>
            </template>

            <!-- json -->
            <template v-else-if="getFieldType(fieldDef) === 'json'">
              <textarea
                class="fv-textarea fv-mono"
                :value="toJsonString(getFieldValue(fieldDef))"
                @input="updateFieldValueJson(key, ($event.target as HTMLTextAreaElement).value)"
                rows="4"
                placeholder="any valid JSON"
              />
              <span v-if="jsonErrors[key]" class="json-err">{{ jsonErrors[key] }}</span>
            </template>

            <!-- custom -->
            <textarea
              v-else-if="getFieldType(fieldDef) === 'custom'"
              class="fv-textarea"
              :value="String(getFieldValue(fieldDef) ?? '')"
              @input="updateFieldValue(key, ($event.target as HTMLTextAreaElement).value)"
              rows="3"
              placeholder="custom content"
            />
          </div>
        </div>

        <!-- 添加新字段 -->
        <div class="add-field-row">
          <input
            v-model="newFieldKey"
            class="fv-input add-key-input"
            placeholder="field name"
            @keydown.enter="addField"
          />
          <select v-model="newFieldType" class="type-select" :class="`ft-${newFieldType}`">
            <option v-for="ft in FIELD_TYPES" :key="ft.value" :value="ft.value">
              {{ ft.label }}
            </option>
          </select>
          <button class="add-field-btn" @click="addField" :disabled="!newFieldKey.trim()">
            + 添加
          </button>
        </div>
      </template>

      <!-- ── Array 节点 ── -->
      <template v-else-if="node.type === 'array'">
        <div v-for="(item, idx) in visibleItems" :key="idx" class="field-row">
          <label class="field-label">[{{ idx }}]</label>
          <input
            class="fv-input"
            :value="String(item)"
            @input="updateArrayItem_root(idx, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div v-if="node.data.length > 5" class="more-hint">+{{ node.data.length - 5 }} more</div>
      </template>

      <!-- ── Text 节点 ── -->
      <template v-else-if="node.type === 'text'">
        <textarea
          class="fv-textarea"
          :value="typeof node.data === 'string' ? node.data : node.data?.text ?? ''"
          @input="updateText(($event.target as HTMLTextAreaElement).value)"
          rows="4"
        />
      </template>

      <!-- ── Table 节点 ── -->
      <template v-else-if="node.type === 'table'">
        <div class="table-info">
          <span>{{ (node.data?.columns ?? []).length }} columns</span>
          <span>{{ (node.data?.rows ?? []).length }} rows</span>
        </div>
      </template>

      <!-- ── JSON 节点 ── -->
      <template v-else-if="node.type === 'json'">
        <textarea
          class="fv-textarea fv-mono"
          :value="rootJsonText"
          @input="updateRootJson(($event.target as HTMLTextAreaElement).value)"
          rows="6"
        />
        <span v-if="rootJsonError" class="json-err">{{ rootJsonError }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import type { NodeModel, FieldType, FieldDef } from '../core/node'
import { isFieldDef, hasTypedFields, createField } from '../core/node'
import { invalidateLayoutCache, computeLayout } from '../layout/index'
import { refreshNode } from '../renderer/nodeRenderer'

const props = defineProps<{ node: NodeModel }>()
const emit = defineEmits<{ close: [] }>()

// ─── 常量 ────────────────────────────────────────────────────
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'string', label: '📝 String' },
  { value: 'array',  label: '📋 Array'  },
  { value: 'object', label: '🔷 Object' },
  { value: 'table',  label: '🗂 Table'  },
  { value: 'json',   label: '{ } JSON'  },
  { value: 'custom', label: '⚙ Custom' }
]

// ─── 工具函数 ────────────────────────────────────────────────
const typeLabel = computed(() => {
  const m: Record<string, string> = {
    object: 'Object', array: 'Array', table: 'Table', json: 'JSON', text: 'Text'
  }
  return m[props.node.type] ?? props.node.type
})

function getFieldType(fieldDef: any): FieldType {
  return isFieldDef(fieldDef) ? fieldDef.type : 'string'
}

function getFieldValue(fieldDef: any): any {
  return isFieldDef(fieldDef) ? fieldDef.value : fieldDef
}

function getFieldArrayValue(fieldDef: any): any[] {
  const v = getFieldValue(fieldDef)
  return Array.isArray(v) ? v : []
}

function toJsonString(v: any): string {
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

// ─── Object 节点：字段列表 ──────────────────────────────────
const objectEntries = computed(() => {
  if (props.node.type !== 'object') return []
  return Object.entries(props.node.data ?? {}) as [string, any][]
})

// 新字段添加状态
const newFieldKey = ref('')
const newFieldType = ref<FieldType>('string')

// JSON 字段错误状态
const jsonErrors = reactive<Record<string, string>>({})

function refreshLayout() {
  invalidateLayoutCache(props.node)
  const layout = computeLayout(props.node)
  props.node.layout.readonly = layout.readonly
  props.node.layout.edit = layout.edit
  refreshNode(props.node)
}

/** 添加新字段 */
function addField() {
  const key = newFieldKey.value.trim()
  if (!key) return
  if (props.node.data[key] !== undefined) return

  props.node.data[key] = createField(newFieldType.value)
  newFieldKey.value = ''
  refreshLayout()
}

/** 删除字段 */
function removeField(key: string) {
  delete props.node.data[key]
  refreshLayout()
}

/** 切换字段类型 */
function changeFieldType(key: string, newType: FieldType) {
  const existing = props.node.data[key]
  const oldValue = isFieldDef(existing) ? existing.value : existing
  props.node.data[key] = createField(newType, tryConvert(oldValue, newType))
  delete jsonErrors[key]
  refreshLayout()
}

function tryConvert(value: any, toType: FieldType): any {
  try {
    if (toType === 'string') return String(value ?? '')
    if (toType === 'array') return Array.isArray(value) ? value : (value ? [value] : [])
    if (toType === 'object') return (typeof value === 'object' && !Array.isArray(value)) ? value : {}
    if (toType === 'json') return value ?? {}
    return value
  } catch { return undefined }
}

/** 更新字段的纯文本值 */
function updateFieldValue(key: string, rawValue: string) {
  const existing = props.node.data[key]
  if (isFieldDef(existing)) {
    existing.value = rawValue
  } else {
    props.node.data[key] = rawValue
  }
  refreshLayout()
}

/** 更新字段的 JSON 值 */
function updateFieldValueJson(key: string, raw: string) {
  try {
    const parsed = JSON.parse(raw)
    const existing = props.node.data[key]
    if (isFieldDef(existing)) {
      existing.value = parsed
    } else {
      props.node.data[key] = parsed
    }
    delete jsonErrors[key]
    refreshLayout()
  } catch {
    jsonErrors[key] = 'Invalid JSON'
  }
}

/** Array 字段：更新子项 */
function updateArrayItem(key: string, idx: number, value: string) {
  const existing = props.node.data[key]
  if (isFieldDef(existing) && Array.isArray(existing.value)) {
    existing.value[idx] = value
  }
  refreshLayout()
}

/** Array 字段：添加子项 */
function addArrayItem(key: string) {
  const existing = props.node.data[key]
  if (isFieldDef(existing) && Array.isArray(existing.value)) {
    existing.value.push('')
  }
  refreshLayout()
}

/** Array 字段：删除子项 */
function removeArrayItem(key: string, idx: number) {
  const existing = props.node.data[key]
  if (isFieldDef(existing) && Array.isArray(existing.value)) {
    existing.value.splice(idx, 1)
  }
  refreshLayout()
}

// ─── Array 节点（根级别）────────────────────────────────────
const visibleItems = computed(() => {
  return Array.isArray(props.node.data) ? props.node.data.slice(0, 5) : []
})

function updateArrayItem_root(idx: number, value: string) {
  props.node.data[idx] = value
  refreshLayout()
}

// ─── Text 节点 ───────────────────────────────────────────────
function updateText(value: string) {
  if (typeof props.node.data === 'string') {
    props.node.data = value
  } else {
    props.node.data.text = value
  }
  refreshLayout()
}

// ─── JSON 节点 ───────────────────────────────────────────────
const rootJsonError = ref('')

const rootJsonText = computed(() => {
  try { return JSON.stringify(props.node.data, null, 2) } catch { return String(props.node.data) }
})

function updateRootJson(raw: string) {
  try {
    props.node.data = JSON.parse(raw)
    rootJsonError.value = ''
    refreshLayout()
  } catch {
    rootJsonError.value = 'Invalid JSON'
  }
}
</script>

<style scoped>
/* ── 壳体 ── */
.node-editor {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06);
  width: 340px;
  font-family: system-ui, sans-serif;
  overflow: hidden;
}

/* ── Header ── */
.editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}
.type-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  color: white;
}
.type-object { background: #6366f1; }
.type-array  { background: #10b981; }
.type-table  { background: #f59e0b; }
.type-json   { background: #8b5cf6; }
.type-text   { background: #64748b; }

.node-id { flex: 1; font-size: 11px; color: #94a3b8; font-family: monospace; }
.close-btn {
  background: none; border: none; cursor: pointer;
  color: #94a3b8; font-size: 14px; padding: 0 4px; line-height: 1;
}
.close-btn:hover { color: #64748b; }

/* ── Body ── */
.editor-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 480px;
  overflow-y: auto;
}

/* ── Typed Field 容器 ── */
.typed-field {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.field-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
}
.field-key {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  font-family: ui-monospace, monospace;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.field-remove-btn {
  background: none; border: none; cursor: pointer;
  color: #cbd5e1; font-size: 11px; padding: 0 2px; line-height: 1;
}
.field-remove-btn:hover { color: #ef4444; }

.field-value-editor {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── 类型选择器 ── */
.type-select {
  font-size: 11px;
  font-weight: 600;
  border: none;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  color: white;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}
.ft-string { background: #64748b; }
.ft-array  { background: #10b981; }
.ft-object { background: #6366f1; }
.ft-table  { background: #f59e0b; }
.ft-json   { background: #8b5cf6; }
.ft-custom { background: #ec4899; }

/* ── 输入控件 ── */
.fv-input {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12px;
  color: #1e293b;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.fv-input:focus { border-color: #6366f1; }
.fv-input--sm { flex: 1; }

.fv-textarea {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: #1e293b;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  line-height: 1.5;
}
.fv-textarea:focus { border-color: #6366f1; }
.fv-mono { font-family: ui-monospace, monospace; font-size: 11px; }

/* ── Array 子项 ── */
.arr-item-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.arr-idx {
  font-size: 10px;
  color: #94a3b8;
  font-family: monospace;
  min-width: 22px;
}
.arr-remove {
  background: none; border: none; cursor: pointer;
  color: #cbd5e1; font-size: 14px; line-height: 1; padding: 0 4px;
}
.arr-remove:hover { color: #ef4444; }
.arr-add-btn {
  font-size: 11px; color: #6366f1; background: none; border: none;
  cursor: pointer; padding: 2px 0; text-align: left;
}
.arr-add-btn:hover { text-decoration: underline; }

/* ── 添加字段行 ── */
.add-field-row {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 6px 2px 2px;
  border-top: 1px dashed #e2e8f0;
  margin-top: 2px;
}
.add-key-input { flex: 1; }
.add-field-btn {
  font-size: 11px;
  font-weight: 600;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 5px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.add-field-btn:disabled { background: #c7d2fe; cursor: not-allowed; }
.add-field-btn:not(:disabled):hover { background: #4f46e5; }

/* ── 非 Object 节点的兼容样式 ── */
.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.field-label {
  font-size: 12px;
  color: #64748b;
  min-width: 50px;
  font-weight: 500;
  font-family: monospace;
}

/* ── 其他 ── */
.json-err { font-size: 11px; color: #ef4444; }
.more-hint { font-size: 11px; color: #94a3b8; text-align: center; padding: 4px; }
.table-info { display: flex; gap: 16px; font-size: 12px; color: #64748b; }
.table-preview { display: flex; flex-direction: column; gap: 4px; }
.table-stat { font-size: 11px; color: #94a3b8; }
</style>

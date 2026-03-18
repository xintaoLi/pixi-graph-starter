<template>
  <div class="node-actions-overlay">
    <template v-for="node in visibleNodes" :key="node.id">
      <!-- Header 右侧操作区：状态指示器 + 编辑按钮 -->
      <div
        class="node-header-actions"
        :style="getHeaderActionsStyle(node)"
      >
        <!-- 状态指示器 -->
        <span
          v-if="showsStatus(node)"
          class="status-icon"
          :class="`status-${node.status ?? 'idle'}`"
          :title="statusLabel(node.status)"
        >
          <!-- loading: CSS 旋转圆环 -->
          <span v-if="(node.status ?? 'idle') === 'loading'" class="spin-ring" />
          <!-- success: 对勾 -->
          <svg v-else-if="node.status === 'success'" viewBox="0 0 12 12" width="12" height="12">
            <polyline points="2,6 5,9 10,3" fill="none" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <!-- error: 叉号 -->
          <svg v-else-if="node.status === 'error'" viewBox="0 0 12 12" width="12" height="12">
            <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          <!-- idle: 灰色小圆点 -->
          <span v-else class="idle-dot" />
        </span>

        <!-- 编辑按钮（editable 节点 hover 时显示） -->
        <button
          v-if="isEditable(node)"
          class="edit-btn"
          :class="{ visible: hoveredNodeId === node.id }"
          title="编辑节点"
          @pointerdown.stop.prevent="onEdit(node)"
        >
          <svg viewBox="0 0 14 14" width="11" height="11">
            <path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { store, setActiveNode } from '../core/store'
import { worldToScreen } from '../core/viewport'
import { resolveNodeTypeConfig } from '../core/nodeTypeRegistry'
import { connectionState } from '../interaction/connectionState'
import type { NodeModel, NodeStatus } from '../core/node'

const DEFAULT_HEADER_H = 40

// ─── 数据 ──────────────────────────────────────────────────────
const visibleNodes = computed(() => Array.from(store.nodes.values()))
const hoveredNodeId = computed(() => connectionState.hoveredNodeId)

// ─── 样式计算 ──────────────────────────────────────────────────

function getHeaderActionsStyle(node: NodeModel) {
  const { width } = node.layout.readonly
  const typeConfig = resolveNodeTypeConfig(node)
  const hh = typeConfig?.headerHeight ?? DEFAULT_HEADER_H
  const z = store.viewport.zoom
  const { x, y } = worldToScreen(node.x + width - 50, node.y)

  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${50 * z}px`,
    height: `${hh * z}px`
  }
}

// ─── 逻辑判断 ──────────────────────────────────────────────────

function showsStatus(node: NodeModel): boolean {
  const cfg = resolveNodeTypeConfig(node)
  return cfg?.showStatus ?? false
}

function isEditable(node: NodeModel): boolean {
  const cfg = resolveNodeTypeConfig(node)
  return cfg?.editable ?? false
}

function statusLabel(status: NodeStatus | undefined): string {
  const labels: Record<NodeStatus, string> = {
    idle: '空闲',
    loading: '加载中',
    success: '成功',
    error: '错误'
  }
  return labels[status ?? 'idle']
}

// ─── 事件处理 ──────────────────────────────────────────────────

function onEdit(node: NodeModel) {
  setActiveNode(node.id)
}
</script>

<style scoped>
.node-actions-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.node-header-actions {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding-right: 8px;
  pointer-events: all;
}

/* ── 状态指示器 ──────────────────────────────── */
.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.idle-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.35);
  border: 1px solid rgba(255,255,255,0.55);
}

/* loading: 旋转圆环 */
.spin-ring {
  display: block;
  width: 11px;
  height: 11px;
  border: 1.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── 编辑按钮 ───────────────────────────────── */
.edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
}

.edit-btn.visible {
  opacity: 1;
}

.edit-btn:hover {
  background: rgba(255,255,255,0.3);
  color: #fff;
}
</style>

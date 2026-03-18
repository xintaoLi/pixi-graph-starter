<template>
  <Transition name="toolbar">
    <div
      v-if="activeNode"
      class="hover-toolbar"
      :class="`pos-${toolbarPosition}`"
      :style="toolbarStyle"
      @pointerenter="onToolbarEnter"
      @pointerleave="onToolbarLeave"
    >
      <!-- Vue 组件模式 -->
      <component
        v-if="isVueComponent"
        :is="toolbarActions"
        :node="activeNode"
      />
      <!-- HTML 字符串模式 -->
      <div v-else v-html="toolbarActions" class="toolbar-html" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import type { Component } from 'vue'
import { store } from '../core/store'
import { worldToScreen } from '../core/viewport'
import { resolveNodeTypeConfig } from '../core/nodeTypeRegistry'
import { connectionState } from '../interaction/connectionState'
import type { NodeModel } from '../core/node'

const DEFAULT_HEADER_H = 32
const TOOLBAR_MARGIN = 6

// ─── 悬停状态追踪 ──────────────────────────────────────────────
// 节点悬停 + 工具栏自身悬停（鼠标移入工具栏时不隐藏）
const toolbarHovered = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const rawHoveredId = computed(() => connectionState.hoveredNodeId)

// 带延迟消抖的显示 id（鼠标移入工具栏时保持显示）
const displayNodeId = ref<string | null>(null)

watch(rawHoveredId, (id) => {
  if (id) {
    clearTimer()
    displayNodeId.value = id
  } else if (!toolbarHovered.value) {
    scheduleHide()
  }
})

function onToolbarEnter() {
  toolbarHovered.value = true
  clearTimer()
}

function onToolbarLeave() {
  toolbarHovered.value = false
  scheduleHide()
}

function scheduleHide() {
  clearTimer()
  hideTimer = setTimeout(() => {
    displayNodeId.value = null
  }, 120)
}

function clearTimer() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

onUnmounted(clearTimer)

// ─── 当前激活节点（有 hoverToolbar 配置的） ───────────────────
const activeNode = computed<NodeModel | null>(() => {
  if (!displayNodeId.value) return null
  const node = store.nodes.get(displayNodeId.value)
  if (!node) return null
  const cfg = resolveNodeTypeConfig(node)
  return cfg?.hoverToolbar ? node : null
})

// ─── 工具栏内容 ────────────────────────────────────────────────
const toolbarConfig = computed(() => {
  if (!activeNode.value) return null
  return resolveNodeTypeConfig(activeNode.value)?.hoverToolbar ?? null
})

const toolbarActions = computed(() => toolbarConfig.value?.actions ?? '')
const toolbarPosition = computed(() => toolbarConfig.value?.position ?? 'top-right')

const isVueComponent = computed(() => {
  return typeof toolbarActions.value === 'object' && toolbarActions.value !== null
})

// ─── 定位 ─────────────────────────────────────────────────────
const toolbarStyle = computed(() => {
  const node = activeNode.value
  if (!node) return {}

  const { width } = node.layout.readonly
  const cfg = resolveNodeTypeConfig(node)
  const hh = cfg?.headerHeight ?? DEFAULT_HEADER_H
  const z = store.viewport.zoom

  const pos = toolbarPosition.value

  // 根据配置位置计算工具栏坐标
  let wx = node.x, wy = node.y

  if (pos === 'top-right') {
    wx = node.x + width
    wy = node.y
  } else if (pos === 'top-left') {
    wx = node.x
    wy = node.y
  } else if (pos === 'bottom') {
    wx = node.x
    wy = node.y + node.layout.readonly.height
  }

  const { x, y } = worldToScreen(wx, wy)

  const baseStyle: Record<string, string> = {
    fontSize: `${Math.max(10, 12 * z)}px`
  }

  if (pos === 'top-right') {
    return { ...baseStyle, left: `${x + TOOLBAR_MARGIN}px`, top: `${y}px` }
  } else if (pos === 'top-left') {
    return { ...baseStyle, right: `${window.innerWidth - x + TOOLBAR_MARGIN}px`, top: `${y}px` }
  } else {
    return { ...baseStyle, left: `${x}px`, top: `${y + TOOLBAR_MARGIN}px` }
  }
})
</script>

<style scoped>
.hover-toolbar {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  pointer-events: all;
  z-index: 30;
  min-width: 120px;
  user-select: none;
}

.toolbar-html {
  color: #e2e8f0;
}

/* 过渡动画 */
.toolbar-enter-active {
  transition: opacity 0.12s, transform 0.12s;
}
.toolbar-leave-active {
  transition: opacity 0.1s, transform 0.1s;
}
.toolbar-enter-from,
.toolbar-leave-to {
  opacity: 0;
  transform: scale(0.94) translateY(-4px);
}
</style>

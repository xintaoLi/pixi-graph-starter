<template>
  <Transition name="edit-panel">
    <div v-if="activeNode" class="overlay-wrapper" :style="overlayStyle">
      <!-- 点击遮罩关闭 -->
      <div class="backdrop" @pointerdown.self="handleClose" />
      <div class="panel" :style="panelStyle">
        <NodeEditor :node="activeNode" @close="handleClose" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { store, setActiveNode } from '../core/store'
import { worldToScreen } from '../core/viewport'
import NodeEditor from './NodeEditor.vue'

const activeNode = computed(() => {
  if (!store.activeNodeId) return null
  return store.nodes.get(store.activeNodeId) ?? null
})

/** 编辑面板定位：与节点左上角 (top:0, left:0) 对齐 */
const overlayStyle = computed(() => ({
  position: 'fixed' as const,
  inset: 0,
  zIndex: 200,
  pointerEvents: 'all' as const
}))

const panelStyle = computed(() => {
  const node = activeNode.value
  if (!node) return {}

  const { x, y } = worldToScreen(node.x, node.y)
  const z = store.viewport.zoom
  const { width, height } = node.layout.readonly

  return {
    position: 'absolute' as const,
    top: `${y}px`,
    left: `${x}px`,
    width: `${width * z}px`,
    minHeight: `${height * z}px`
  }
})

function handleClose() {
  setActiveNode(null)
}
</script>

<style scoped>
.overlay-wrapper {
  pointer-events: all;
}

/* 半透明遮罩（可点击关闭） */
.backdrop {
  position: fixed;
  inset: 0;
  background: transparent;
  cursor: default;
}

.panel {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  max-height: 80vh;
  overflow-y: auto;
}

/* 面板出现动画 */
.edit-panel-enter-active {
  transition: opacity 0.15s, transform 0.15s;
}
.edit-panel-leave-active {
  transition: opacity 0.12s, transform 0.1s;
}
.edit-panel-enter-from {
  opacity: 0;
}
.edit-panel-leave-to {
  opacity: 0;
}
</style>

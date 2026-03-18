<template>
  <div class="toolbar" :class="{ 'pan-active': toolState.current === 'pan' || toolState.spacePanning }">
    <!-- 工具选择 -->
    <div class="toolbar-group">
      <button
        class="tool-btn"
        :class="{ active: toolState.current === 'select' && !toolState.spacePanning }"
        @click="setTool('select')"
        title="选择 (V)"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 3l14 9-7 1-3 7z"/>
        </svg>
        选择
      </button>
      <button
        class="tool-btn"
        :class="{ active: toolState.current === 'pan' || toolState.spacePanning }"
        @click="setTool('pan')"
        title="拖拽平移 (H / 按住 Space)"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l-4 4 4 4m-4-4h11M15 5l4 4-4 4m4-4H8"/>
        </svg>
        平移
      </button>
    </div>

    <div class="toolbar-divider"/>

    <!-- 添加节点 -->
    <div class="toolbar-group">
      <button class="tool-btn" @click="addNode('object')" title="添加 Object 节点">
        <span class="dot" style="background:#6366f1"/>Obj
      </button>
      <button class="tool-btn" @click="addNode('array')" title="添加 Array 节点">
        <span class="dot" style="background:#10b981"/>Arr
      </button>
      <button class="tool-btn" @click="addNode('text')" title="添加 Text 节点">
        <span class="dot" style="background:#64748b"/>Txt
      </button>
    </div>

    <div class="toolbar-divider"/>

    <!-- 画布信息 -->
    <div class="toolbar-info">
      <span>{{ store.nodes.size }} 节点</span>
      <span>{{ store.edges.size }} 边</span>
    </div>

    <!-- 快捷键提示 -->
    <div class="toolbar-hint">Space + 拖拽 = 平移</div>
  </div>
</template>

<script setup lang="ts">
import { store, addNode as storeAddNode } from '../core/store'
import { toolState, setTool } from '../core/toolState'
import { computeLayout } from '../layout/index'
import { createNode } from '../core/node'
import type { NodeType } from '../core/node'
import { renderNode } from '../renderer/nodeRenderer'
import { rebuildIndex } from '../interaction/hitTest'
import { getScene } from '../renderer/scene'

function addNode(type: NodeType) {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const { x, y, zoom } = store.viewport
  const worldX = (cx - x) / zoom
  const worldY = (cy - y) / zoom

  const id = 'node-' + Date.now()
  const defaultData: Record<NodeType, any> = {
    object: { name: '', value: '' },
    array: ['item 1', 'item 2'],
    table: { columns: ['col1', 'col2'], rows: [] },
    json: { key: 'value' },
    text: { text: 'New text node' }
  }

  const data = defaultData[type]
  const node = createNode({ id, type, x: worldX - 120, y: worldY - 40, data })
  node.layout = computeLayout(node)

  storeAddNode(node)

  const { nodes: nodesContainer } = getScene()
  renderNode(node, nodesContainer)
  rebuildIndex(store.nodes)
}
</script>

<style scoped>
.toolbar {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  background: white;
  border-radius: 10px;
  padding: 6px 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06);
  z-index: 200;
  font-family: system-ui, sans-serif;
  font-size: 12px;
  pointer-events: all;
  user-select: none;
  transition: box-shadow 0.15s;
}

.toolbar.pan-active {
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.2), 0 1px 4px rgba(99, 102, 241, 0.1);
}

.toolbar-group { display: flex; gap: 2px; }

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #e2e8f0;
  margin: 0 4px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px 8px;
  border-radius: 6px;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;
}

.tool-btn:hover { background: #f1f5f9; color: #1e293b; }
.tool-btn.active { background: #ede9fe; color: #6366f1; }

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.toolbar-info {
  display: flex;
  gap: 8px;
  color: #94a3b8;
  font-size: 11px;
  padding-left: 6px;
  border-left: 1px solid #e2e8f0;
}

.toolbar-hint {
  font-size: 10px;
  color: #cbd5e1;
  padding-left: 6px;
  border-left: 1px solid #e2e8f0;
  white-space: nowrap;
}
</style>

<template>
  <div class="port-overlay">

    <!-- ① 节点级 + 按钮：Header 右侧垂直居中，向右偏移 50% 自身宽度 -->
    <div
      v-for="node in fieldableNodes"
      :key="`np-${node.id}`"
      class="port-btn port-btn--node"
      :class="{ 'is-active': connectionState.active }"
      :style="getNodePortStyle(node)"
      title="以整个节点为输出连线"
      @pointerdown.stop.prevent="startFromNode(node)"
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <line x1="5" y1="1.5" x2="5" y2="8.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="1.5" y1="5" x2="8.5" y2="5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </div>

    <!-- ② 字段行 + 按钮：hovered 行的右上角，向右偏移 50% 自身宽度 -->
    <Transition name="port-fade">
      <div
        v-if="hoveredFieldStyle && !connectionState.active"
        key="field-btn"
        class="port-btn port-btn--field"
        :style="hoveredFieldStyle"
        title="以此字段/行为输出连线"
        @pointerdown.stop.prevent="startFromField"
      >
        <svg width="9" height="9" viewBox="0 0 10 10">
          <line x1="5" y1="1.5" x2="5" y2="8.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="1.5" y1="5" x2="8.5" y2="5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
    </Transition>

    <!-- ③ 连线中提示条 -->
    <Transition name="port-fade">
      <div v-if="connectionState.active" key="hint" class="conn-hint">
        点击目标节点或字段完成连线 &nbsp;·&nbsp; <kbd>Esc</kbd> 取消
      </div>
    </Transition>

    <!-- ④ 临时连线 SVG -->
    <svg
      v-if="connectionState.active"
      class="conn-svg"
      :width="svgSize.w"
      :height="svgSize.h"
    >
      <defs>
        <marker id="conn-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#3b82f6" />
        </marker>
      </defs>
      <path
        v-if="tempPath"
        :d="tempPath"
        fill="none"
        stroke="#3b82f6"
        stroke-width="1.5"
        stroke-dasharray="6 3"
        marker-end="url(#conn-arrow)"
        opacity="0.85"
      />
    </svg>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { store } from '../core/store'
import { worldToScreen } from '../core/viewport'
import {
  getPortWorldPosition,
  getFieldPortButtonPosition,
  isFieldPortableNode,
  CANVAS_LAYOUT
} from '../core/port'
import { resolveNodeTypeConfig } from '../core/nodeTypeRegistry'
import { connectionState, startConnection, cancelConnection } from '../interaction/connectionState'
import type { NodeModel } from '../core/node'

// ─── 节点列表（仅 Array/Object/Table 才显示端口） ──────────────
const fieldableNodes = computed(() =>
  Array.from(store.nodes.values()).filter(isFieldPortableNode)
)

// ─── SVG 画布尺寸 ──────────────────────────────────────────────
const svgSize = ref({ w: window.innerWidth, h: window.innerHeight })
function updateSvgSize() {
  svgSize.value = { w: window.innerWidth, h: window.innerHeight }
}

// ─── 节点端口按钮：Header 右边缘垂直居中，按钮中心在节点右边缘 ─
const NODE_BTN = 22  // 节点端口按钮直径 px

function getNodePortStyle(node: NodeModel): Record<string, string> {
  const { width } = node.layout.readonly
  const typeConfig = resolveNodeTypeConfig(node)
  const hh = typeConfig?.headerHeight ?? CANVAS_LAYOUT.HEADER_H
  const z = store.viewport.zoom

  // 世界坐标：header 右侧垂直居中
  const { x, y } = worldToScreen(node.x + width, node.y + hh / 2)

  const size = Math.max(NODE_BTN, NODE_BTN * Math.sqrt(z))  // 随 zoom 适度缩放

  return {
    left: `${x}px`,
    top: `${y}px`,
    // 向右偏移 50%（自身宽度的一半在节点外），垂直居中
    transform: `translate(-50%, -50%)`,
    width: `${size}px`,
    height: `${size}px`
  }
}

// ─── 字段行端口按钮：hovered 行的右上角 ────────────────────────
const FIELD_BTN = 18  // 字段端口按钮直径 px

const hoveredFieldStyle = computed<Record<string, string> | null>(() => {
  const { hoveredNodeId, hoveredFieldKey } = connectionState
  if (!hoveredNodeId || !hoveredFieldKey) return null

  const node = store.nodes.get(hoveredNodeId)
  if (!node || !isFieldPortableNode(node)) return null

  const z = store.viewport.zoom
  // 使用行顶部位置（非行中心）—— 按钮显示在行上沿
  const btnWorld = getFieldPortButtonPosition(node, hoveredFieldKey)
  const { x, y } = worldToScreen(btnWorld.x, btnWorld.y)

  const size = Math.max(FIELD_BTN, FIELD_BTN * Math.sqrt(z))

  return {
    left: `${x}px`,
    top: `${y}px`,
    // 向右偏移 50%，垂直居中于行上沿
    transform: `translate(-50%, -50%)`,
    width: `${size}px`,
    height: `${size}px`
  }
})

// ─── 临时连线 SVG 路径 ─────────────────────────────────────────
const tempPath = computed<string | null>(() => {
  if (!connectionState.active || !connectionState.sourcePort) return null

  const srcNode = store.nodes.get(connectionState.sourcePort.nodeId)
  if (!srcNode) return null

  const srcWorld = getPortWorldPosition(srcNode, connectionState.sourcePort)
  const src = worldToScreen(srcWorld.x, srcWorld.y)
  const dst = { x: connectionState.mouseScreenX, y: connectionState.mouseScreenY }

  if (src.x === 0 && src.y === 0) return null

  const cp = Math.max(Math.abs(dst.x - src.x) * 0.5, 60)
  return `M ${src.x} ${src.y} C ${src.x + cp} ${src.y} ${dst.x - cp} ${dst.y} ${dst.x} ${dst.y}`
})

// ─── 连线操作 ──────────────────────────────────────────────────
function startFromNode(node: NodeModel) {
  startConnection({ nodeId: node.id, portType: 'node' })
  const { width } = node.layout.readonly
  const typeConfig = resolveNodeTypeConfig(node)
  const hh = typeConfig?.headerHeight ?? CANVAS_LAYOUT.HEADER_H
  const { x, y } = worldToScreen(node.x + width, node.y + hh / 2)
  connectionState.mouseScreenX = x
  connectionState.mouseScreenY = y
}

function startFromField() {
  const { hoveredNodeId, hoveredFieldKey } = connectionState
  if (!hoveredNodeId || !hoveredFieldKey) return
  startConnection({ nodeId: hoveredNodeId, portType: 'field', fieldKey: hoveredFieldKey })
  const node = store.nodes.get(hoveredNodeId)!
  const portWorld = getPortWorldPosition(node, { nodeId: hoveredNodeId, portType: 'field', fieldKey: hoveredFieldKey })
  const { x, y } = worldToScreen(portWorld.x, portWorld.y)
  connectionState.mouseScreenX = x
  connectionState.mouseScreenY = y
}

// ─── Esc 取消 ──────────────────────────────────────────────────
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') cancelConnection()
}

onMounted(() => {
  window.addEventListener('resize', updateSvgSize)
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateSvgSize)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.port-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

/* ── 通用端口按钮 ──────────────────────────────────────────── */
.port-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: crosshair;
  pointer-events: all;
  color: #fff;
  transition: background 0.12s, box-shadow 0.12s, transform 0.1s;
  box-sizing: border-box;
}

/* ── 节点级按钮（Header 居中，稍大） ──────────────────────── */
.port-btn--node {
  background: #3b82f6;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(59,130,246,.5);
  z-index: 12;
}
.port-btn--node:hover {
  background: #1d4ed8;
  box-shadow: 0 4px 14px rgba(59,130,246,.65);
  transform: translate(-50%, -50%) scale(1.2) !important;
}
.port-btn--node.is-active {
  background: #bfdbfe;
  border-color: #3b82f6;
}

/* ── 字段行按钮（行上沿，稍小） ───────────────────────────── */
.port-btn--field {
  background: #3b82f6;
  border: 1.5px solid #fff;
  box-shadow: 0 2px 6px rgba(59,130,246,.4);
  z-index: 13;
}
.port-btn--field:hover {
  background: #1d4ed8;
  box-shadow: 0 3px 10px rgba(59,130,246,.55);
  transform: translate(-50%, -50%) scale(1.15) !important;
}

/* ── 连线提示条 ─────────────────────────────────────────────── */
.conn-hint {
  position: absolute;
  bottom: 56px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  background: rgba(15,23,42,.85);
  color: #e2e8f0;
  font-size: 12px;
  border-radius: 20px;
  pointer-events: none;
  white-space: nowrap;
  backdrop-filter: blur(4px);
  z-index: 20;
}
.conn-hint kbd {
  background: rgba(255,255,255,.15);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 11px;
}

/* ── SVG 临时连线 ──────────────────────────────────────────── */
.conn-svg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 9;
}

/* ── 过渡 ──────────────────────────────────────────────────── */
.port-fade-enter-active,
.port-fade-leave-active {
  transition: opacity 0.12s, transform 0.12s;
}
.port-fade-enter-from,
.port-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.7) !important;
}
</style>

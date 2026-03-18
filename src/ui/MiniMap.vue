<template>
  <div class="minimap-root" :style="rootStyle" v-if="minimapConfig.visible">
    <!-- minimap canvas -->
    <div class="minimap-frame">
      <div class="minimap-title">概览</div>
      <canvas
        ref="canvasRef"
        class="minimap-canvas"
        :width="minimapConfig.width"
        :height="minimapConfig.height"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      />
    </div>

    <!-- zoom controls below minimap -->
    <div class="zoom-bar">
      <button class="zoom-btn" @click="zoomOut" title="缩小">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <span class="zoom-value">{{ zoomPercent }}%</span>
      <button class="zoom-btn" @click="zoomIn" title="放大">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button class="zoom-btn reset-btn" @click="resetZoom" title="重置视图">适应</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { store } from '../core/store'
import { screenToWorld, applyViewportZoom } from '../core/viewport'
import { applyViewportToScene } from '../renderer/scene'
import { minimapConfig } from './minimapConfig'

// ─── 位置 / 样式 ───────────────────────────────────────────────
const rootStyle = computed(() => {
  const pos = minimapConfig.position
  const style: Record<string, string> = { position: 'fixed' }

  const toPx = (v: number | string | undefined) =>
    v === undefined ? undefined : typeof v === 'number' ? `${v}px` : v

  if (toPx(pos.top) !== undefined) style.top = toPx(pos.top)!
  if (toPx(pos.left) !== undefined) style.left = toPx(pos.left)!
  if (toPx(pos.bottom) !== undefined) style.bottom = toPx(pos.bottom)!
  if (toPx(pos.right) !== undefined) style.right = toPx(pos.right)!

  return style
})

// ─── Zoom 控制 ────────────────────────────────────────────────
const zoomPercent = computed(() => Math.round(store.viewport.zoom * 100))

function zoomIn() {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  applyViewportZoom(1, cx, cy)
  applyViewportToScene(store.viewport.x, store.viewport.y, store.viewport.zoom)
}

function zoomOut() {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  applyViewportZoom(-1, cx, cy)
  applyViewportToScene(store.viewport.x, store.viewport.y, store.viewport.zoom)
}

function resetZoom() {
  fitView()
}

// ─── Minimap Canvas 渲染 ──────────────────────────────────────
const canvasRef = ref<HTMLCanvasElement | null>(null)

const NODE_TYPE_COLORS: Record<string, string> = {
  object: '#6366f1',
  array: '#10b981',
  table: '#f59e0b',
  json: '#8b5cf6',
  text: '#64748b'
}

// 当前帧的变换参数，供点击交互使用
let mapScale = 1
let mapOffX = 0
let mapOffY = 0

function getWorldBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  store.nodes.forEach(node => {
    const { width, height } = node.layout.readonly
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + width)
    maxY = Math.max(maxY, node.y + height)
  })

  if (!isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

function drawMinimap() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = minimapConfig.width
  const H = minimapConfig.height

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, W, H)

  const bounds = getWorldBounds()
  if (!bounds) {
    // 无节点时显示提示
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '10px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('暂无节点', W / 2, H / 2)
    return
  }

  const { minX, minY, maxX, maxY } = bounds
  const PAD = 30
  const worldW = maxX - minX + PAD * 2
  const worldH = maxY - minY + PAD * 2

  const CONTENT_W = W - 4
  const CONTENT_H = H - 4

  const scaleX = CONTENT_W / worldW
  const scaleY = CONTENT_H / worldH
  mapScale = Math.min(scaleX, scaleY)

  mapOffX = (W - worldW * mapScale) / 2 - (minX - PAD) * mapScale
  mapOffY = (H - worldH * mapScale) / 2 - (minY - PAD) * mapScale

  // 画节点
  store.nodes.forEach(node => {
    const { width, height } = node.layout.readonly
    const nx = node.x * mapScale + mapOffX
    const ny = node.y * mapScale + mapOffY
    const nw = Math.max(2, width * mapScale)
    const nh = Math.max(2, height * mapScale)

    const color = NODE_TYPE_COLORS[node.type] ?? '#94a3b8'
    ctx.fillStyle = color + '28'
    ctx.fillRect(nx, ny, nw, nh)

    // header 条
    const headerH = Math.max(1, Math.min(6, 32 * mapScale))
    ctx.fillStyle = color
    ctx.fillRect(nx, ny, nw, headerH)
  })

  // 画视口框
  const vTopLeft = screenToWorld(0, 0)
  const vBottomRight = screenToWorld(window.innerWidth, window.innerHeight)

  const vx = vTopLeft.x * mapScale + mapOffX
  const vy = vTopLeft.y * mapScale + mapOffY
  const vw = (vBottomRight.x - vTopLeft.x) * mapScale
  const vh = (vBottomRight.y - vTopLeft.y) * mapScale

  // 视口阴影填充
  ctx.fillStyle = 'rgba(59, 130, 246, 0.06)'
  ctx.fillRect(vx, vy, vw, vh)

  // 视口边框
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1.5
  ctx.setLineDash([3, 2])
  ctx.strokeRect(vx, vy, vw, vh)
  ctx.setLineDash([])
}

function fitView() {
  const bounds = getWorldBounds()
  if (!bounds) {
    store.viewport.x = 0
    store.viewport.y = 0
    store.viewport.zoom = 1
    applyViewportToScene(0, 0, 1)
    return
  }

  const { minX, minY, maxX, maxY } = bounds
  const PAD = 60
  const worldW = maxX - minX + PAD * 2
  const worldH = maxY - minY + PAD * 2

  const zoom = Math.min(4, Math.max(0.1, Math.min(
    window.innerWidth / worldW,
    window.innerHeight / worldH
  )))

  store.viewport.zoom = zoom
  store.viewport.x = window.innerWidth / 2 - (minX + (maxX - minX) / 2) * zoom
  store.viewport.y = window.innerHeight / 2 - (minY + (maxY - minY) / 2) * zoom
  applyViewportToScene(store.viewport.x, store.viewport.y, store.viewport.zoom)
}

// ─── minimap 拖拽交互 ─────────────────────────────────────────
let isDraggingMap = false

function minimapCoordsToWorld(mx: number, my: number) {
  return {
    worldX: (mx - mapOffX) / mapScale,
    worldY: (my - mapOffY) / mapScale
  }
}

function navigateTo(mx: number, my: number) {
  const { worldX, worldY } = minimapCoordsToWorld(mx, my)
  store.viewport.x = window.innerWidth / 2 - worldX * store.viewport.zoom
  store.viewport.y = window.innerHeight / 2 - worldY * store.viewport.zoom
  applyViewportToScene(store.viewport.x, store.viewport.y, store.viewport.zoom)
  drawMinimap()
}

function onPointerDown(e: PointerEvent) {
  isDraggingMap = true
  ;(e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId)
  navigateTo(e.offsetX, e.offsetY)
}

function onPointerMove(e: PointerEvent) {
  if (!isDraggingMap) return
  navigateTo(e.offsetX, e.offsetY)
}

function onPointerUp(e: PointerEvent) {
  isDraggingMap = false
}

// ─── 响应 store 变化重绘 ──────────────────────────────────────
let rafId: number | null = null

function scheduleDraw() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    drawMinimap()
  })
}

watch(
  () => [store.viewport.x, store.viewport.y, store.viewport.zoom, store.nodes.size],
  () => scheduleDraw()
)

// 节点移动时也触发重绘（通过 watch nodes Map 的 size 无法捕获位移）
// 用 ticker 每 200ms 刷新一次 minimap 做位移同步
let ticker: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  drawMinimap()
  ticker = setInterval(scheduleDraw, 200)
})

onUnmounted(() => {
  if (ticker !== null) clearInterval(ticker)
  if (rafId !== null) cancelAnimationFrame(rafId)
})

// ─── 暴露 API ────────────────────────────────────────────────
defineExpose({ fitView, drawMinimap })
</script>

<style scoped>
.minimap-root {
  z-index: 150;
  pointer-events: all;
  user-select: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.minimap-frame {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.minimap-title {
  font-family: system-ui, sans-serif;
  font-size: 10px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 5px 8px 3px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
}

.minimap-canvas {
  display: block;
  cursor: crosshair;
}

.zoom-bar {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.10), 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 3px 4px;
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 5px;
  color: #475569;
  font-size: 11px;
  font-weight: 500;
  font-family: system-ui, sans-serif;
  transition: background 0.12s;
  white-space: nowrap;
  line-height: 1;
}

.zoom-btn:hover { background: #f1f5f9; color: #1e293b; }
.zoom-btn:active { background: #e2e8f0; }

.zoom-value {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  font-family: system-ui, monospace;
  min-width: 44px;
  text-align: center;
  padding: 0 2px;
}

.reset-btn {
  color: #6366f1;
  font-size: 10px;
  margin-left: 2px;
  padding: 4px 7px;
  border-left: 1px solid #e2e8f0;
}
</style>

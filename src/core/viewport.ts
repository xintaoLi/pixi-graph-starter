import { store } from './store'

export function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
  const { x, y, zoom } = store.viewport
  return {
    x: worldX * zoom + x,
    y: worldY * zoom + y
  }
}

export function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
  const { x, y, zoom } = store.viewport
  return {
    x: (screenX - x) / zoom,
    y: (screenY - y) / zoom
  }
}

export function applyViewportToPan(dx: number, dy: number) {
  store.viewport.x += dx
  store.viewport.y += dy
}

export function applyViewportZoom(delta: number, pivotX: number, pivotY: number) {
  const zoomFactor = delta > 0 ? 1.1 : 0.9
  const newZoom = Math.min(4, Math.max(0.1, store.viewport.zoom * zoomFactor))

  const worldPivot = screenToWorld(pivotX, pivotY)

  store.viewport.zoom = newZoom

  const newScreen = worldToScreen(worldPivot.x, worldPivot.y)
  store.viewport.x += pivotX - newScreen.x
  store.viewport.y += pivotY - newScreen.y
}

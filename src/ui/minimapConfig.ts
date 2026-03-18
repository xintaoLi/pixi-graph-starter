import { reactive } from 'vue'

export interface MinimapPosition {
  top?: number | string
  left?: number | string
  bottom?: number | string
  right?: number | string
}

export interface MinimapConfig {
  width: number
  height: number
  visible: boolean
  position: MinimapPosition
}

export const minimapConfig = reactive<MinimapConfig>({
  width: 200,
  height: 140,
  visible: true,
  position: {
    bottom: 20,
    right: 20
  }
})

/**
 * API: 动态调整 minimap 位置
 * @example setMinimapPosition({ bottom: 40, right: 40 })
 * @example setMinimapPosition({ top: 20, left: 20 })
 */
export function setMinimapPosition(pos: MinimapPosition) {
  minimapConfig.position = { ...pos }
}

export function setMinimapSize(width: number, height: number) {
  minimapConfig.width = width
  minimapConfig.height = height
}

export function setMinimapVisible(visible: boolean) {
  minimapConfig.visible = visible
}

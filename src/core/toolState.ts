import { reactive } from 'vue'

export type ToolMode = 'select' | 'pan'

export const toolState = reactive<{
  current: ToolMode
  spacePanning: boolean
}>({
  current: 'select',
  spacePanning: false
})

export function setTool(mode: ToolMode) {
  toolState.current = mode
}

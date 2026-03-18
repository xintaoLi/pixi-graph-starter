import { reactive } from 'vue'
import type { PortRef } from '../core/port'

export interface ConnectionState {
  /** 是否正在拖拽连线 */
  active: boolean
  /** 连线起点端口 */
  sourcePort: PortRef | null
  /** 鼠标当前世界坐标（用于 PixiJS 渲染临时线） */
  mouseWorldX: number
  mouseWorldY: number
  /** 鼠标当前屏幕坐标（用于 SVG overlay 渲染临时线） */
  mouseScreenX: number
  mouseScreenY: number
  /** 当前悬停的节点 id */
  hoveredNodeId: string | null
  /** 当前悬停的字段 key（仅 object/array/table） */
  hoveredFieldKey: string | null
}

export const connectionState = reactive<ConnectionState>({
  active: false,
  sourcePort: null,
  mouseWorldX: 0,
  mouseWorldY: 0,
  mouseScreenX: 0,
  mouseScreenY: 0,
  hoveredNodeId: null,
  hoveredFieldKey: null
})

/** 从某端口开始连线 */
export function startConnection(port: PortRef) {
  connectionState.active = true
  connectionState.sourcePort = { ...port }
}

/** 取消当前连线（Escape 或点击空白处） */
export function cancelConnection() {
  connectionState.active = false
  connectionState.sourcePort = null
}

/**
 * 完成连线，返回 source/target 端口引用
 * 调用后自动重置状态
 */
export function completeConnection(targetPort: PortRef): { source: PortRef; target: PortRef } | null {
  if (!connectionState.active || !connectionState.sourcePort) return null
  // 不允许自连
  if (connectionState.sourcePort.nodeId === targetPort.nodeId) {
    cancelConnection()
    return null
  }
  const result = {
    source: { ...connectionState.sourcePort },
    target: { ...targetPort }
  }
  connectionState.active = false
  connectionState.sourcePort = null
  return result
}

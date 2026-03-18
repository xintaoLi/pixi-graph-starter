import type { PortRef } from './port'

export interface EdgeModel {
  id: string
  source: string
  target: string
  /** 连线起点端口（未设置则使用节点中心） */
  sourcePort?: PortRef
  /** 连线终点端口（未设置则使用节点中心） */
  targetPort?: PortRef
  data?: any
}

export function createEdge(partial: Pick<EdgeModel, 'id' | 'source' | 'target'> & Partial<EdgeModel>): EdgeModel {
  return {
    data: {},
    ...partial
  }
}

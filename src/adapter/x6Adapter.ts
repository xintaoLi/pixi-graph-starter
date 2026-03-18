/**
 * X6 迁移适配器
 *
 * 用途：将 AntV X6 图数据（节点/边）转换为本画布引擎格式。
 *
 * 使用方式：
 *   import { migrateGraph } from './adapter/x6Adapter'
 *   const { nodes, edges } = migrateGraph(x6GraphInstance)
 *   nodes.forEach(n => { storeAddNode(n); renderNode(n, container) })
 *   edges.forEach(e => { storeAddEdge(e); renderEdge(e, store.nodes, edgeContainer) })
 */

import type { NodeModel, NodeType } from '../core/node'
import type { EdgeModel } from '../core/edge'
import { createNode } from '../core/node'
import { createEdge } from '../core/edge'
import { computeLayout } from '../layout/index'

// ──────────────────────────────────────────────
// 类型映射
// ──────────────────────────────────────────────

export interface X6NodeShape {
  id: string
  shape?: string
  data?: any
  position?: () => { x: number; y: number }
  getPosition?: () => { x: number; y: number }
  getData?: () => any
  size?: () => { width: number; height: number }
  getSize?: () => { width: number; height: number }
  attrs?: {
    label?: { text?: string }
    body?: { fill?: string }
  }
}

export interface X6EdgeShape {
  id: string
  getSourceCellId?: () => string
  getTargetCellId?: () => string
  source?: string | { cell: string }
  target?: string | { cell: string }
  getData?: () => any
}

export interface X6GraphShape {
  getNodes: () => X6NodeShape[]
  getEdges: () => X6EdgeShape[]
}

/**
 * 根据 X6 节点的 shape / data 推断画布引擎节点类型
 */
export function mapX6Type(x6Node: X6NodeShape): NodeType {
  const shape = x6Node.shape ?? ''
  const data = typeof x6Node.getData === 'function' ? x6Node.getData() : x6Node.data

  if (shape.includes('table') || (data && data.columns && data.rows)) return 'table'
  if (shape.includes('array') || Array.isArray(data)) return 'array'
  if (shape.includes('json') || (data && data.__type === 'json')) return 'json'
  if (shape.includes('text') || typeof data === 'string') return 'text'

  return 'object'
}

function getX6Position(x6Node: X6NodeShape): { x: number; y: number } {
  if (typeof x6Node.getPosition === 'function') return x6Node.getPosition()
  if (typeof x6Node.position === 'function') return x6Node.position()
  return { x: 0, y: 0 }
}

function getX6Data(x6Node: X6NodeShape): any {
  if (typeof x6Node.getData === 'function') {
    const d = x6Node.getData()
    if (d != null) return d
  }
  if (x6Node.data != null) return x6Node.data
  // 回退：从 attrs 提取文本
  const labelText = x6Node.attrs?.label?.text
  if (labelText) return { text: labelText }
  return {}
}

function getX6EdgeEndpoint(endpoint: string | { cell: string } | undefined): string {
  if (!endpoint) return ''
  if (typeof endpoint === 'string') return endpoint
  return endpoint.cell ?? ''
}

// ──────────────────────────────────────────────
// 单节点迁移
// ──────────────────────────────────────────────

export function fromX6Node(x6Node: X6NodeShape): NodeModel {
  const { x, y } = getX6Position(x6Node)
  const data = getX6Data(x6Node)
  const type = mapX6Type(x6Node)

  const node = createNode({
    id: x6Node.id,
    type,
    x,
    y,
    data
  })

  node.layout = computeLayout(node)
  return node
}

// ──────────────────────────────────────────────
// 单边迁移
// ──────────────────────────────────────────────

export function fromX6Edge(x6Edge: X6EdgeShape): EdgeModel {
  const source =
    typeof x6Edge.getSourceCellId === 'function'
      ? x6Edge.getSourceCellId()
      : getX6EdgeEndpoint(x6Edge.source)

  const target =
    typeof x6Edge.getTargetCellId === 'function'
      ? x6Edge.getTargetCellId()
      : getX6EdgeEndpoint(x6Edge.target)

  return createEdge({
    id: x6Edge.id,
    source,
    target,
    data: typeof x6Edge.getData === 'function' ? x6Edge.getData() : undefined
  })
}

// ──────────────────────────────────────────────
// 批量迁移（推荐入口）
// ──────────────────────────────────────────────

export interface MigrateResult {
  nodes: NodeModel[]
  edges: EdgeModel[]
  skippedNodes: string[]
  skippedEdges: string[]
}

export function migrateGraph(x6Graph: X6GraphShape): MigrateResult {
  const nodes: NodeModel[] = []
  const edges: EdgeModel[] = []
  const skippedNodes: string[] = []
  const skippedEdges: string[] = []
  const nodeIds = new Set<string>()

  for (const x6Node of x6Graph.getNodes()) {
    try {
      const node = fromX6Node(x6Node)
      nodes.push(node)
      nodeIds.add(node.id)
    } catch (err) {
      console.warn(`[x6Adapter] 跳过节点 ${x6Node.id}:`, err)
      skippedNodes.push(x6Node.id)
    }
  }

  for (const x6Edge of x6Graph.getEdges()) {
    try {
      const edge = fromX6Edge(x6Edge)
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        console.warn(`[x6Adapter] 跳过边 ${x6Edge.id}: 端点节点不存在`)
        skippedEdges.push(x6Edge.id)
        continue
      }
      edges.push(edge)
    } catch (err) {
      console.warn(`[x6Adapter] 跳过边 ${x6Edge.id}:`, err)
      skippedEdges.push(x6Edge.id)
    }
  }

  return { nodes, edges, skippedNodes, skippedEdges }
}

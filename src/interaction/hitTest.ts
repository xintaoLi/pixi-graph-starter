import RBush from 'rbush'
import type { NodeModel } from '../core/node'

interface RBushItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  node: NodeModel
}

const tree = new RBush<RBushItem>()

export function rebuildIndex(nodes: Map<string, NodeModel>) {
  tree.clear()

  nodes.forEach(node => {
    const { width, height } = node.layout.readonly
    tree.insert({
      minX: node.x,
      minY: node.y,
      maxX: node.x + width,
      maxY: node.y + height,
      node
    })
  })
}

export function updateNodeInIndex(node: NodeModel) {
  const { width, height } = node.layout.readonly
  const items = tree.search({
    minX: node.x - 1,
    minY: node.y - 1,
    maxX: node.x + width + 1,
    maxY: node.y + height + 1
  })
  const existing = items.find(item => item.node.id === node.id)
  if (existing) tree.remove(existing)

  tree.insert({
    minX: node.x,
    minY: node.y,
    maxX: node.x + width,
    maxY: node.y + height,
    node
  })
}

export function hitTest(worldX: number, worldY: number): NodeModel | null {
  const results = tree.search({
    minX: worldX,
    minY: worldY,
    maxX: worldX,
    maxY: worldY
  })
  return results[0]?.node ?? null
}

export function searchInRect(x1: number, y1: number, x2: number, y2: number): NodeModel[] {
  const results = tree.search({
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2)
  })
  return results.map(r => r.node)
}

export function removeNodeFromIndex(node: NodeModel) {
  const { width, height } = node.layout.readonly
  const items = tree.search({
    minX: node.x,
    minY: node.y,
    maxX: node.x + width,
    maxY: node.y + height
  })
  const existing = items.find(item => item.node.id === node.id)
  if (existing) tree.remove(existing)
}

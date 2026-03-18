import type { NodeLayout } from '../core/node'

const MAX_DEPTH = 3
const MAX_NODES = 50
const ROW_HEIGHT = 22

let nodeCount = 0

function calcJsonHeight(value: any, depth: number): number {
  if (depth >= MAX_DEPTH || nodeCount >= MAX_NODES) return ROW_HEIGHT

  nodeCount++

  if (typeof value === 'object' && value !== null) {
    const children = Array.isArray(value) ? value : Object.values(value)
    return ROW_HEIGHT + children.reduce((sum: number, child: any) => {
      return sum + calcJsonHeight(child, depth + 1)
    }, 0)
  }

  return ROW_HEIGHT
}

export function computeJsonLayout(data: any): NodeLayout {
  nodeCount = 0
  const contentHeight = calcJsonHeight(data, 0)
  const headerHeight = 40
  const padding = 16

  const totalReadonly = Math.min(headerHeight + contentHeight + padding, 400)
  const totalEdit = Math.min(headerHeight + contentHeight + padding + 40, 500)

  return {
    readonly: { width: 260, height: totalReadonly },
    edit: { width: 320, height: totalEdit }
  }
}

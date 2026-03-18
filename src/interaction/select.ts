import * as PIXI from 'pixi.js'
import type { NodeModel } from '../core/node'
import { store, setSelected } from '../core/store'
import { searchInRect } from './hitTest'
import { refreshNode } from '../renderer/nodeRenderer'

interface SelectionBox {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

let selectionBox: SelectionBox | null = null
let selectionGraphics: PIXI.Graphics | null = null

export function startBoxSelect(worldX: number, worldY: number) {
  selectionBox = {
    startX: worldX,
    startY: worldY,
    currentX: worldX,
    currentY: worldY
  }
}

export function updateBoxSelect(worldX: number, worldY: number, graphics: PIXI.Graphics) {
  if (!selectionBox) return
  selectionBox.currentX = worldX
  selectionBox.currentY = worldY
  selectionGraphics = graphics

  graphics.clear()
  graphics.rect(
    Math.min(selectionBox.startX, worldX),
    Math.min(selectionBox.startY, worldY),
    Math.abs(worldX - selectionBox.startX),
    Math.abs(worldY - selectionBox.startY)
  )
  graphics.fill({ color: 0x3b82f6, alpha: 0.1 })
  graphics.stroke({ color: 0x3b82f6, width: 1 })
}

export function endBoxSelect(): NodeModel[] {
  if (!selectionBox) return []

  const nodes = searchInRect(
    selectionBox.startX,
    selectionBox.startY,
    selectionBox.currentX,
    selectionBox.currentY
  )

  if (selectionGraphics) {
    selectionGraphics.clear()
  }

  selectionBox = null
  selectionGraphics = null

  return nodes
}

export function selectNode(node: NodeModel, additive = false) {
  if (additive) {
    const ids = [...store.selectedNodeIds, node.id]
    setSelected(ids)
  } else {
    setSelected([node.id])
  }
  refreshNode(node)
}

export function deselectAll() {
  const prevIds = [...store.selectedNodeIds]
  setSelected([])
  prevIds.forEach(id => {
    const node = store.nodes.get(id)
    if (node) refreshNode(node)
  })
}

export function isBoxSelecting(): boolean {
  return selectionBox !== null
}

import * as PIXI from 'pixi.js'
import type { EdgeModel } from '../core/edge'
import type { NodeModel } from '../core/node'
import { getPortWorldPosition, getTargetPortWorldPosition } from '../core/port'

const EDGE_COLOR      = 0x94a3b8
const EDGE_COLOR_PORT = 0x3b82f6  // 带端口信息的边使用蓝色
const EDGE_WIDTH      = 1.5
const ARROW_SIZE      = 8

const edgeGraphicsMap = new Map<string, PIXI.Graphics>()

// ─── 端点计算 ─────────────────────────────────────────────────

interface EdgeEndpoints {
  srcX: number
  srcY: number
  tgtX: number
  tgtY: number
}

function getEdgeEndpoints(
  edge:   EdgeModel,
  source: NodeModel,
  target: NodeModel
): EdgeEndpoints {
  const { width: sw, height: sh } = source.layout.readonly
  const { width: tw, height: th } = target.layout.readonly

  let srcX: number, srcY: number

  // ── 源端口（出口） ──────────────────────────────────────────
  if (edge.sourcePort) {
    const pos = getPortWorldPosition(source, edge.sourcePort)
    srcX = pos.x
    srcY = pos.y
  } else {
    // 无显式端口：从源节点右侧中心出发
    srcX = source.x + sw
    srcY = source.y + sh / 2
  }

  let tgtX: number, tgtY: number

  // ── 目标端口（入口）：选择距离源最近的入口侧 ────────────────
  if (edge.targetPort) {
    // 传入 srcX 让函数选择最优入口侧（左/右）
    const pos = getTargetPortWorldPosition(target, edge.targetPort, srcX)
    tgtX = pos.x
    tgtY = pos.y
  } else {
    // 无显式端口：选择最近的水平入口侧
    const useLeft = srcX < target.x + tw / 2
    tgtX = useLeft ? target.x : target.x + tw
    tgtY = target.y + th / 2
  }

  return { srcX, srcY, tgtX, tgtY }
}

// ─── 绘制 ─────────────────────────────────────────────────────

function getArrowAngle(
  srcX: number, srcY: number,
  tgtX: number, tgtY: number
): number {
  return Math.atan2(tgtY - srcY, tgtX - srcX)
}

function drawArrow(
  g:     PIXI.Graphics,
  x:     number,
  y:     number,
  angle: number
) {
  const a1 = angle + Math.PI * 0.8
  const a2 = angle - Math.PI * 0.8
  g.moveTo(x, y)
  g.lineTo(x + Math.cos(a1) * ARROW_SIZE, y + Math.sin(a1) * ARROW_SIZE)
  g.moveTo(x, y)
  g.lineTo(x + Math.cos(a2) * ARROW_SIZE, y + Math.sin(a2) * ARROW_SIZE)
}

function drawEdge(
  edge:   EdgeModel,
  source: NodeModel,
  target: NodeModel,
  g:      PIXI.Graphics
) {
  g.clear()

  const { srcX, srcY, tgtX, tgtY } = getEdgeEndpoints(edge, source, target)
  const angle   = getArrowAngle(srcX, srcY, tgtX, tgtY)
  const hasPort = !!(edge.sourcePort || edge.targetPort)
  const color   = hasPort ? EDGE_COLOR_PORT : EDGE_COLOR

  // 贝塞尔控制点偏移量（最小 60，最大 120）
  const cp = Math.min(Math.max(Math.abs(tgtX - srcX) * 0.5, 60), 120)

  // cp1：source 出口方向（从右出）
  const cp1x = srcX + cp
  // cp2：target 入口方向
  //   - tgtX > srcX（target 在右）：从左入，控制点向左  → tgtX - cp
  //   - tgtX < srcX（target 在左）：从右入，控制点向右  → tgtX + cp
  const cp2x = tgtX >= srcX ? tgtX - cp : tgtX + cp

  g.setStrokeStyle({ color, width: EDGE_WIDTH })
  g.moveTo(srcX, srcY)
  g.bezierCurveTo(cp1x, srcY, cp2x, tgtY, tgtX, tgtY)
  g.stroke()

  drawArrow(g, tgtX, tgtY, angle)
  g.stroke()
}

// ─── 公共 API ─────────────────────────────────────────────────

export function renderEdge(
  edge:      EdgeModel,
  nodes:     Map<string, NodeModel>,
  container: PIXI.Container
): PIXI.Graphics | null {
  const source = nodes.get(edge.source)
  const target = nodes.get(edge.target)
  if (!source || !target) return null

  let g = edgeGraphicsMap.get(edge.id)
  if (!g) {
    g = new PIXI.Graphics()
    container.addChild(g)
    edgeGraphicsMap.set(edge.id, g)
  }

  drawEdge(edge, source, target, g)
  return g
}

export function updateEdge(edge: EdgeModel, nodes: Map<string, NodeModel>) {
  const g = edgeGraphicsMap.get(edge.id)
  if (!g) return
  const source = nodes.get(edge.source)
  const target = nodes.get(edge.target)
  if (source && target) drawEdge(edge, source, target, g)
}

export function removeEdge(id: string) {
  const g = edgeGraphicsMap.get(id)
  if (g) {
    g.parent?.removeChild(g)
    g.destroy()
    edgeGraphicsMap.delete(id)
  }
}

export function clearAllEdges() {
  edgeGraphicsMap.forEach(g => g.destroy())
  edgeGraphicsMap.clear()
}

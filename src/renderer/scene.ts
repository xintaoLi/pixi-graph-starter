import * as PIXI from 'pixi.js'
import type { Application } from 'pixi.js'

export interface SceneContainers {
  root: PIXI.Container
  edges: PIXI.Container
  nodes: PIXI.Container
  selection: PIXI.Container
}

let containers: SceneContainers | null = null

export function initScene(app: Application): SceneContainers {
  const root = new PIXI.Container()
  const edges = new PIXI.Container()
  const nodes = new PIXI.Container()
  const selection = new PIXI.Container()

  root.addChild(edges)
  root.addChild(nodes)
  root.addChild(selection)

  app.stage.addChild(root)

  containers = { root, edges, nodes, selection }
  return containers
}

export function getScene(): SceneContainers {
  if (!containers) throw new Error('Scene not initialized')
  return containers
}

export function applyViewportToScene(x: number, y: number, zoom: number) {
  if (!containers) return
  containers.root.x = x
  containers.root.y = y
  containers.root.scale.set(zoom)
}

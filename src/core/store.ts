import { reactive } from 'vue'
import type { NodeModel } from './node'
import type { EdgeModel } from './edge'

export interface ViewportState {
  x: number
  y: number
  zoom: number
}

export interface AppStore {
  nodes: Map<string, NodeModel>
  edges: Map<string, EdgeModel>
  viewport: ViewportState
  activeNodeId: string | null
  selectedNodeIds: Set<string>
}

export const store = reactive<AppStore>({
  nodes: new Map(),
  edges: new Map(),
  viewport: {
    x: 0,
    y: 0,
    zoom: 1
  },
  activeNodeId: null,
  selectedNodeIds: new Set()
})

export function addNode(node: NodeModel) {
  store.nodes.set(node.id, node)
}

export function removeNode(id: string) {
  store.nodes.delete(id)
  store.edges.forEach((edge, edgeId) => {
    if (edge.source === id || edge.target === id) {
      store.edges.delete(edgeId)
    }
  })
}

export function addEdge(edge: EdgeModel) {
  store.edges.set(edge.id, edge)
}

export function setActiveNode(id: string | null) {
  if (store.activeNodeId) {
    const prev = store.nodes.get(store.activeNodeId)
    if (prev) prev.state.editing = false
  }
  store.activeNodeId = id
  if (id) {
    const node = store.nodes.get(id)
    if (node) node.state.editing = true
  }
}

export function setSelected(ids: string[]) {
  store.selectedNodeIds.forEach(id => {
    const node = store.nodes.get(id)
    if (node) node.state.selected = false
  })
  store.selectedNodeIds = new Set(ids)
  ids.forEach(id => {
    const node = store.nodes.get(id)
    if (node) node.state.selected = true
  })
}

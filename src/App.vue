<template>
  <div class="canvas-root" :class="{ 'cursor-pan': isPanning, 'cursor-crosshair': connectionState.active }">
    <canvas ref="canvasRef" class="pixi-canvas" />
    <div class="overlay-layer">
      <Overlay />
    </div>
    <!-- full 模式节点 HTML 内容层（位于 canvas 之上，port/toolbar 之下） -->
    <FullHeightNodes />
    <!-- 端口连线交互层 -->
    <PortOverlay />
    <!-- 节点 header 右侧：状态指示器 + 编辑按钮 -->
    <NodeActionsOverlay />
    <!-- hover 节点时弹出工具栏 -->
    <NodeHoverToolbar />
    <Toolbar />
    <MiniMap ref="miniMapRef" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, defineComponent, h } from 'vue'
import Overlay from './ui/Overlay.vue'
import Toolbar from './ui/Toolbar.vue'
import MiniMap from './ui/MiniMap.vue'
import PortOverlay from './ui/PortOverlay.vue'
import NodeActionsOverlay from './ui/NodeActionsOverlay.vue'
import NodeHoverToolbar from './ui/NodeHoverToolbar.vue'
import FullHeightNodes from './ui/FullHeightNodes.vue'
import { connectionState } from './interaction/connectionState'
import { registerNodeType, registerNodeTypes } from './core/nodeTypeRegistry'
import { toolState } from './core/toolState'
import { createPixiApp } from './renderer/app'
import { initScene } from './renderer/scene'
import { renderNode } from './renderer/nodeRenderer'
import { renderEdge } from './renderer/edgeRenderer'
import { rebuildIndex } from './interaction/hitTest'
import { initEventSystem } from './interaction/eventSystem'
import { store, addNode, addEdge } from './core/store'
import { computeLayout } from './layout/index'
import { createNode } from './core/node'
import { createEdge } from './core/edge'

// ── 演示：注册自定义节点类型 ────────────────────────────────

// 1. compact 模式 + 带状态 + 可编辑（最常见场景）
registerNodeType('data-source', {
  base: 'object',
  headerBackground: 0x0f766e,
  fontIcon: { icon: '⛁' },
  showStatus: true,
  editable: true,
  clickBehavior: 'select',   // 点击选中，编辑按钮才进入编辑态
  heightMode: 'compact',
  hoverToolbar: {
    position: 'top-right',
    // 使用 HTML 字符串定义工具栏内容
    actions: `
      <div style="display:flex;flex-direction:column;gap:4px;">
        <button onclick="alert('刷新数据源')" style="padding:4px 10px;background:#0f766e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">⟳ 刷新</button>
        <button onclick="alert('查看来源')" style="padding:4px 10px;background:rgba(255,255,255,0.1);color:#e2e8f0;border:1px solid rgba(255,255,255,0.2);border-radius:4px;cursor:pointer;font-size:12px;">⇱ 来源</button>
      </div>
    `
  }
})

// 2. full 高度模式（HTML 全量展示）+ 带状态
registerNodeType('full-table', {
  base: 'table',
  headerBackground: 0x7c3aed,
  fontIcon: { icon: '⊞' },
  showStatus: true,
  editable: true,
  clickBehavior: 'edit',     // 点击直接进入编辑态
  heightMode: 'full',
  defaultHeight: 160
})

// 3. full 高度模式 Object 节点
registerNodeType('config-node', {
  base: 'object',
  headerBackground: 0xb45309,
  fontIcon: { icon: '⚙' },
  showStatus: false,
  editable: true,
  clickBehavior: 'select',   // 点击选中，Hover 工具栏按钮操作
  heightMode: 'full',
  defaultHeight: 200,
  hoverToolbar: {
    position: 'top-right',
    // 使用 Vue 组件定义工具栏
    actions: defineComponent({
      props: ['node'],
      setup(props) {
        return () => h('div', { style: 'display:flex;flex-direction:column;gap:5px;' }, [
          h('div', { style: 'color:#94a3b8;font-size:11px;padding:0 4px 2px;border-bottom:1px solid rgba(255,255,255,0.1)' }, `⚙ ${props.node?.id}`),
          h('button', {
            style: 'padding:4px 10px;background:#b45309;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;',
            onClick: () => alert(`验证配置: ${props.node?.id}`)
          }, '✓ 验证'),
          h('button', {
            style: 'padding:4px 10px;background:rgba(255,255,255,0.08);color:#e2e8f0;border:1px solid rgba(255,255,255,0.15);border-radius:4px;cursor:pointer;font-size:12px;',
            onClick: () => alert(`复制配置: ${props.node?.id}`)
          }, '⊕ 复制')
        ])
      }
    })
  }
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const miniMapRef = ref<InstanceType<typeof MiniMap> | null>(null)
let cleanupEvents: (() => void) | null = null

const isPanning = computed(() => toolState.current === 'pan' || toolState.spacePanning)

function generateSampleData() {
  const nodeTypes = ['object', 'array', 'text', 'table', 'json'] as const
  const sampleData: Record<string, any> = {
    // object 节点：使用 FieldDef 格式，每个属性携带 type
    object: {
      username:  { type: 'string', value: 'Alice' },
      tags:      { type: 'array',  value: ['vue', 'pixi', 'graph'] },
      profile:   { type: 'object', value: { role: 'engineer', level: 3 } },
      metadata:  { type: 'json',   value: { created: '2024-01', version: 2 } },
      report:    { type: 'table',  value: { columns: ['month', 'score'], rows: [['Jan', '90'], ['Feb', '85']] } }
    },
    array: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
    text: { text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
    table: { columns: ['id', 'name', 'value'], rows: [['1', 'foo', '100'], ['2', 'bar', '200']] },
    json: { api: 'v2', status: 'ok', data: { count: 42 } }
  }

  const count = 20
  const cols = 5
  const gapX = 300
  const gapY = 200
  const offsetX = 60
  const offsetY = 60

  for (let i = 0; i < count; i++) {
    const type = nodeTypes[i % nodeTypes.length]
    const col = i % cols
    const row = Math.floor(i / cols)
    const id = `demo-${i}`

    // 每隔 5 个节点演示节点级图标覆盖（实际业务中按需配置）
    const metaOverride = i % 5 === 0 ? { icon: '★', headerColor: 0xef4444, label: `Special·${i}` } : undefined

    const node = createNode({
      id,
      type,
      x: offsetX + col * gapX,
      y: offsetY + row * gapY,
      data: JSON.parse(JSON.stringify(sampleData[type])),
      meta: metaOverride
    })
    node.layout = computeLayout(node)
    addNode(node)
  }

  // 创建示例边
  for (let i = 0; i < count - 1; i += 3) {
    const edge = createEdge({
      id: `edge-${i}`,
      source: `demo-${i}`,
      target: `demo-${i + 1}`
    })
    addEdge(edge)
  }

  // ── 演示自定义节点类型 ───────────────────────────────────────

  // data-source：compact + 状态 + 编辑按钮 + hover 工具栏
  const ds = createNode({
    id: 'custom-ds-1',
    type: 'object',
    customType: 'data-source',
    x: 60,
    y: offsetY + Math.ceil(count / cols) * gapY + 20,
    data: {
      host:     { type: 'string', value: 'db.example.com' },
      port:     { type: 'string', value: '5432' },
      database: { type: 'string', value: 'analytics' },
      schema:   { type: 'string', value: 'public' }
    },
    status: 'success'
  })
  ds.layout = computeLayout(ds)
  addNode(ds)

  // data-source：loading 状态
  const ds2 = createNode({
    id: 'custom-ds-2',
    type: 'object',
    customType: 'data-source',
    x: 370,
    y: offsetY + Math.ceil(count / cols) * gapY + 20,
    data: {
      endpoint: { type: 'string', value: 'https://api.example.com/v2' },
      auth:     { type: 'object', value: { type: 'bearer', token: '***' } },
      timeout:  { type: 'string', value: '30s' }
    },
    status: 'loading'
  })
  ds2.layout = computeLayout(ds2)
  addNode(ds2)

  // full-table：全量展示表格 + 状态
  const ft = createNode({
    id: 'custom-ft-1',
    type: 'table',
    customType: 'full-table',
    x: 680,
    y: offsetY + Math.ceil(count / cols) * gapY + 20,
    data: {
      columns: ['id', 'name', 'department', 'salary'],
      rows: [
        ['1', 'Alice',   'Engineering', '¥45,000'],
        ['2', 'Bob',     'Product',     '¥38,000'],
        ['3', 'Charlie', 'Design',      '¥36,000'],
        ['4', 'Diana',   'Engineering', '¥52,000'],
        ['5', 'Eve',     'Marketing',   '¥34,000']
      ]
    },
    status: 'success'
  })
  ft.layout = computeLayout(ft)
  addNode(ft)

  // config-node：full Object + Vue 组件工具栏
  const cn = createNode({
    id: 'custom-cn-1',
    type: 'object',
    customType: 'config-node',
    x: 990,
    y: offsetY + Math.ceil(count / cols) * gapY + 20,
    data: {
      retries:     { type: 'string', value: '3' },
      timeout:     { type: 'string', value: '60s' },
      batchSize:   { type: 'string', value: '1000' },
      compression: { type: 'string', value: 'gzip' },
      logging:     { type: 'object', value: { level: 'info', output: 'stdout' } },
      cache:       { type: 'object', value: { ttl: 300, maxSize: '512MB' } }
    }
  })
  cn.layout = computeLayout(cn)
  addNode(cn)
}

onMounted(async () => {
  if (!canvasRef.value) return

  const app = await createPixiApp(canvasRef.value)
  const { nodes: nodesContainer, edges: edgesContainer } = initScene(app)

  generateSampleData()

  store.nodes.forEach(node => renderNode(node, nodesContainer))
  store.edges.forEach(edge => renderEdge(edge, store.nodes, edgesContainer))

  rebuildIndex(store.nodes)
  cleanupEvents = initEventSystem(canvasRef.value)
})

onUnmounted(() => {
  cleanupEvents?.()
})
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  overflow: hidden;
  background: #f0f2f5;
}

.canvas-root {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.canvas-root.cursor-pan,
.canvas-root.cursor-pan .pixi-canvas {
  cursor: grab;
}

.canvas-root.cursor-crosshair,
.canvas-root.cursor-crosshair .pixi-canvas {
  cursor: crosshair;
}

.canvas-root.cursor-pan:active,
.canvas-root.cursor-pan .pixi-canvas:active {
  cursor: grabbing;
}

.pixi-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.overlay-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  overflow: visible;
}
</style>

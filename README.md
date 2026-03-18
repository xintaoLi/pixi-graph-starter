好，这一步我直接给你**可以落地的工程级方案**，分两大部分：

---

# 一、完整实现方案（PixiJS + rbush + Vue3）

👉 目标：**替换 X6，构建类 Figma 画布引擎**

---

## 1️⃣ 项目结构（直接按这个建）

```text
src/
├── core/                # 核心数据层
│   ├── store.ts
│   ├── node.ts
│   ├── edge.ts
│   └── viewport.ts
│
├── layout/              # 布局引擎（重点）
│   ├── index.ts
│   ├── object.ts
│   ├── array.ts
│   ├── table.ts
│   ├── jsonTree.ts
│   └── text.ts
│
├── renderer/            # Pixi 渲染层
│   ├── app.ts
│   ├── nodeRenderer.ts
│   ├── edgeRenderer.ts
│   └── scene.ts
│
├── interaction/         # 交互系统
│   ├── hitTest.ts
│   ├── drag.ts
│   ├── select.ts
│   └── eventSystem.ts
│
├── ui/                  # Vue UI层
│   ├── NodeEditor.vue
│   ├── Overlay.vue
│   └── Toolbar.vue
│
├── adapter/             # X6 迁移层（后面讲）
│   └── x6Adapter.ts
│
└── main.ts
```

---

# 二、核心模块实现

---

# 2️⃣ Core 数据层

## Node 定义（统一标准）

```ts
export interface NodeModel {
  id: string
  type: 'object' | 'array' | 'table' | 'json' | 'text'

  x: number
  y: number

  data: any

  layout: {
    readonly: { width: number; height: number }
    edit: { width: number; height: number }
  }

  state: {
    selected: boolean
    hover: boolean
    editing: boolean
  }
}
```

---

## Store

```ts
import { reactive } from 'vue'

export const store = reactive({
  nodes: new Map<string, NodeModel>(),
  edges: [],

  viewport: {
    x: 0,
    y: 0,
    zoom: 1
  },

  activeNodeId: null
})
```

---

# 3️⃣ Layout Engine（核心模块）

👉 这是整个系统“稳定性关键”

---

## 统一入口

```ts
export function computeLayout(node, context) {
  switch (node.type) {
    case 'object':
      return computeObjectLayout(node, context)
    case 'array':
      return computeArrayLayout(node, context)
    case 'table':
      return computeTableLayout(node, context)
    case 'json':
      return computeJsonLayout(node, context)
    case 'text':
      return computeTextLayout(node, context)
  }
}
```

---

## 示例：Object Layout

```ts
export function computeObjectLayout(node) {
  const fields = Object.keys(node.data)

  const readonlyHeight =
    40 + Math.min(fields.length, 3) * 28

  const editHeight =
    50 + fields.length * 36

  return {
    readonly: {
      width: 240,
      height: readonlyHeight
    },
    edit: {
      width: 300,
      height: editHeight
    }
  }
}
```

---

# 4️⃣ 渲染层（Pixi）

基于 PixiJS

---

## Scene 初始化

```ts
import * as PIXI from 'pixi.js'

export const app = new PIXI.Application({
  resizeTo: window,
  antialias: true
})

document.body.appendChild(app.view)

export const nodeContainer = new PIXI.Container()
app.stage.addChild(nodeContainer)
```

---

## NodeRenderer

```ts
export function renderNode(node) {
  const g = new PIXI.Graphics()

  const { width, height } = node.layout.readonly

  g.beginFill(0xffffff)
  g.drawRoundedRect(0, 0, width, height, 8)
  g.endFill()

  g.x = node.x
  g.y = node.y

  return g
}
```

---

## 增量更新

```ts
function updateNode(node, graphics) {
  graphics.clear()

  const { width, height } = node.layout.readonly

  graphics.beginFill(0xffffff)
  graphics.drawRect(0, 0, width, height)
}
```

---

# 5️⃣ 空间索引（命中检测）

基于 rbush

---

```ts
const tree = new RBush()

export function rebuildIndex(nodes) {
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
```

---

## 点击检测

```ts
export function hitTest(x, y) {
  const result = tree.search({
    minX: x,
    minY: y,
    maxX: x,
    maxY: y
  })

  return result[0]?.node
}
```

---

# 6️⃣ 交互系统

---

## 点击

```ts
canvas.addEventListener('pointerdown', (e) => {
  const pos = toWorld(e)

  const node = hitTest(pos.x, pos.y)

  if (node) {
    store.activeNodeId = node.id
    node.state.editing = true
  }
})
```

---

# 7️⃣ Vue Overlay（编辑层）

---

## Overlay.vue

```vue
<template>
  <div v-if="node" :style="style" class="overlay">
    <NodeEditor :node="node" />
  </div>
</template>
```

---

## 定位同步

```ts
const style = computed(() => {
  const node = activeNode.value

  const { x, y } = worldToScreen(node)

  return {
    transform: `
      translate(${x}px, ${y}px)
      scale(${viewport.zoom})
    `
  }
})
```

---

# 三、X6 → 新架构迁移方案（重点）

👉 你现在最关键的不是“重写”，而是**无损迁移**

---

# 1️⃣ 核心思路

👉 X6 = 数据源
👉 新引擎 = 渲染器

---

# 2️⃣ X6 数据结构

```js
node = {
  id,
  position: { x, y },
  size: { width, height },
  data
}
```

---

# 3️⃣ 转换函数（核心）

```ts
export function fromX6Node(x6Node): NodeModel {
  const node: NodeModel = {
    id: x6Node.id,
    type: mapType(x6Node),

    x: x6Node.position().x,
    y: x6Node.position().y,

    data: x6Node.getData(),

    layout: computeLayout(x6Node.getData()),

    state: {
      selected: false,
      hover: false,
      editing: false
    }
  }

  return node
}
```

---

# 4️⃣ 批量迁移

```ts
graph.getNodes().forEach(x6Node => {
  const node = fromX6Node(x6Node)
  store.nodes.set(node.id, node)
})
```

---

# 5️⃣ 边迁移

```ts
edge = {
  source: x6Edge.getSourceCellId(),
  target: x6Edge.getTargetCellId()
}
```

---

# 6️⃣ 兼容策略（关键）

## 初期（推荐）

👉 双引擎共存：

```text
X6（旧）
 +
Pixi（新）
```

---

## 渐进替换

| 阶段  | 行为        |
| --- | --------- |
| 阶段1 | Pixi 只渲染  |
| 阶段2 | Pixi 接管交互 |
| 阶段3 | 删除 X6     |

---

# 四、关键风险点（必须提前处理）

---

## ❗1：布局不一致

👉 解决：

* Layout Engine 必须统一
* X6 高度不可信

---

## ❗2：HTML 表单依赖

👉 解决：

* 抽象成 NodeEditor（Vue组件）
* 不依赖 X6

---

## ❗3：交互差异

👉 解决：

* 自建事件系统（不要依赖 X6）

---

# 五、最终效果

你会得到：

* ✅ 1000+ 节点流畅
* ✅ HTML 编辑能力保留
* ✅ 可扩展（协同 / 分组 / miniMap）
* ✅ 完全摆脱 X6 限制

---

# 六、一句话总结

> 👉 **用 Pixi 重新“画”，用 Layout Engine 统一“算”，用 Adapter 平滑“迁”**

---

# 如果你下一步要继续

我可以帮你直接补👇

✅ 一套完整 starter repo（目录 + 可运行代码）
✅ Layout Engine 全实现（含 JSON Tree）
✅ NodeEditor 动态表单系统（Object / Array / Table）
✅ 性能压测脚本（1000 / 5000 节点）

这一步你已经从“用库”进入“造引擎”了，方向是对的。

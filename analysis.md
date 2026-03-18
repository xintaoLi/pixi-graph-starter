这个问题你提得非常关键，而且**必须在架构阶段设计好**，否则后面会反复推翻。

我先直接给你一个结论👇

---

# ❗核心结论（必须统一认知）

> 👉 **节点高度不能依赖“真实 DOM 渲染结果”来决定**
> 👉 必须有一套**纯计算的“布局引擎（Layout Engine）”**

否则你会遇到：

* ❌ Canvas 节点无法预先确定高度
* ❌ DOM Overlay 和 Canvas 不一致（抖动/跳变）
* ❌ 性能爆炸（频繁测量 DOM）

---

# ✅ 正确方案：双态布局引擎（核心设计）

你提到两个状态：

* 编辑态（HTML复杂）
* 只读态（Canvas展示）

👉 我建议你做：

## 👉 **统一的 Layout Engine（纯 JS 计算）**

```text
输入：node.data + type + parent context
输出：
{
  readonly: { width, height },
  edit: { width, height }
}
```

---

# 一、整体设计

```text id="3j6k7x"
Node
 ├─ data
 ├─ layout
 │   ├─ readonlyBox
 │   └─ editBox
 └─ renderer（canvas / html）
```

---

# 二、核心函数（必须实现）

```ts
type LayoutResult = {
  readonly: { width: number; height: number }
  edit: { width: number; height: number }
}

function computeLayout(node): LayoutResult
```

---

# 三、根据数据类型拆分布局策略（重点）

你提到几种类型👇
我们逐个给“可计算公式”

---

## 1️⃣ Object Form（表单）

### 编辑态（关键）

👉 本质：**表单行数 × 行高**

```js
height =
  headerHeight +
  fieldCount * rowHeight +
  padding
```

```js
const rowHeight = 36
const headerHeight = 40
```

---

### 只读态

👉 可以压缩：

```js
height =
  titleHeight +
  min(fieldCount, 3) * previewRowHeight
```

---

## 2️⃣ Array Form（列表）

```js
height =
  header +
  itemCount * itemHeight
```

👉 大数组必须限制：

```js
visibleCount = Math.min(itemCount, 5)
```

---

## 3️⃣ Table（表格）

👉 关键：列数 + 行数

```js
height =
  header +
  rowCount * rowHeight
```

👉 优化：

* 超过 N 行 → 折叠 + “...”

---

## 4️⃣ JSON Tree（最复杂）

👉 必须“递归计算”

```js
function calcJsonHeight(tree, depth = 0) {
  if (!expanded) return rowHeight

  return (
    rowHeight +
    children.reduce((sum, child) => sum + calcJsonHeight(child), 0)
  )
}
```

---

👉 必须限制：

```js
maxDepth = 3
maxNodes = 50
```

否则直接炸

---

## 5️⃣ string（文本）

👉 用文本测量（Pixi）

```js
const metrics =
  PIXI.TextMetrics.measureText(text, style)

height = metrics.height + padding
```

---

# 四、父级影响（你提到的关键点）

> “根据父级数据确定高度”

👉 正确做法是：

## 👉 上下文参与计算

```ts
function computeLayout(node, context) {}
```

---

### 示例

```js
context = {
  parentType: 'table',
  depth: 2,
  compact: true
}
```

---

### 不同策略

```js
if (context.compact) {
  rowHeight = 28
} else {
  rowHeight = 36
}
```

---

👉 这一步非常关键：

> ❗否则子节点会无限膨胀

---

# 五、编辑态 vs 只读态（核心差异）

| 维度  | 编辑态  | 只读态    |
| --- | ---- | ------ |
| 精确度 | 高    | 低      |
| 高度  | 大    | 小      |
| 内容  | 完整   | 摘要     |
| 渲染  | HTML | Canvas |

---

## 👉 设计原则

> ❗**只读态必须“可预测”**
> ❗**编辑态允许“更高但稳定”**

---

# 六、避免抖动（非常重要）

## ❌ 错误做法

```text
Canvas → 显示节点
↓
DOM 渲染 → 高度变化
↓
Canvas resize（跳动）
```

---

## ✅ 正确做法

```text
computeLayout（预计算）
↓
Canvas 渲染（稳定）
↓
DOM Overlay 使用同一尺寸
```

---

# 七、缓存机制（必须做）

```js
const layoutCache = new Map()

function getLayout(node) {
  const key = hash(node.data)

  if (layoutCache.has(key)) {
    return layoutCache.get(key)
  }

  const layout = computeLayout(node)
  layoutCache.set(key, layout)

  return layout
}
```

---

👉 否则：

* 1000节点 × 每帧计算 = 爆炸

---

# 八、动态更新（编辑时）

```js
watch(node.data, () => {
  node.layout = computeLayout(node)
  markDirty(node)
})
```

---

👉 注意：

* ❌ 不要每次输入都算
* ✅ debounce（200ms）

---

# 九、你最终的“高度体系”

```text id="jkl5xq"
数据（data）
   ↓
Layout Engine（纯计算）
   ↓
Node.layout
   ↓
Canvas（readonly）
   ↓
DOM Overlay（edit）
```

---

# 十、一句话总结（非常关键）

> 👉 **“节点高度 = 数据函数，而不是 DOM 结果”**

---

# 如果你要继续往下做

我可以帮你直接补全👇

### ✅ 一整套 Layout Engine 实现（可直接用）

* Object / Array / Table / JSON Tree
* 支持父子上下文
* 带缓存 + 性能优化

### ✅ + NodeRenderer（Pixi 对齐布局）

### ✅ + Vue Form 渲染规范（和 layout 对齐）

这一步做好，你整个系统会非常稳，不会再反复推翻。

import type { App } from 'vue'
import PixiGraphCanvas from './components/PixiGraphCanvas.vue'
import MiniMap from './ui/MiniMap.vue'
import Toolbar from './ui/Toolbar.vue'
import NodeEditor from './ui/NodeEditor.vue'

/**
 * Vue 插件 - 全局注册所有组件
 *
 * @example
 * import PixiGraphEngine from 'pixi-graph-engine'
 * app.use(PixiGraphEngine)
 *
 * // 之后可在任何模板直接使用：
 * // <PixiGraphCanvas />
 * // <PixiMiniMap />
 * // <PixiToolbar />
 * // <PixiNodeEditor :node="node" />
 */
const PixiGraphPlugin = {
  install(app: App) {
    app.component('PixiGraphCanvas', PixiGraphCanvas)
    app.component('PixiMiniMap', MiniMap)
    app.component('PixiToolbar', Toolbar)
    app.component('PixiNodeEditor', NodeEditor)
  }
}

export default PixiGraphPlugin

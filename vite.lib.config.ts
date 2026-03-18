import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/main.ts', 'src/App.vue'],
      outDir: 'dist',
      tsconfigPath: './tsconfig.build.json',
      rollupTypes: true,
      insertTypesEntry: true
    })
  ],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PixiGraphEngine',
      fileName: 'pixi-graph-engine'
    },

    rollupOptions: {
      // 这些依赖不打包，由宿主环境提供
      external: ['vue', 'pixi.js', 'rbush'],
      output: {
        globals: {
          vue: 'Vue',
          'pixi.js': 'PIXI',
          rbush: 'RBush'
        },
        // 保留模块结构（便于 tree-shaking）
        preserveModules: false,
        exports: 'named'
      }
    },

    sourcemap: true,
    minify: false
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})

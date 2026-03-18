import * as PIXI from 'pixi.js'
import { getScene } from './scene'

let pixiApp: PIXI.Application | null = null

export interface PixiAppOptions {
  backgroundColor?: number
  antialias?: boolean
  resolution?: number
}

export async function createPixiApp(
  canvas: HTMLCanvasElement,
  options: PixiAppOptions = {}
): Promise<PIXI.Application> {
  // 若已有实例则先销毁
  if (pixiApp) {
    pixiApp.destroy()
    pixiApp = null
  }

  const app = new PIXI.Application()

  await app.init({
    canvas,
    resizeTo: canvas.parentElement ?? window,
    antialias: options.antialias ?? true,
    backgroundColor: options.backgroundColor ?? 0xf0f2f5,
    resolution: options.resolution ?? (window.devicePixelRatio || 1),
    autoDensity: true
  })

  pixiApp = app
  return app
}

export function getPixiApp(): PIXI.Application {
  if (!pixiApp) throw new Error('PixiJS app not initialized')
  return pixiApp
}

export function destroyPixiApp() {
  if (pixiApp) {
    pixiApp.destroy()
    pixiApp = null
  }
}

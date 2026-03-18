import type { NodeLayout } from '../core/node'

const CHAR_WIDTH = 8
const LINE_HEIGHT = 20
const MAX_WIDTH = 320
const PADDING = 24

export function computeTextLayout(data: { text?: string } | string): NodeLayout {
  const text = typeof data === 'string' ? data : (data?.text ?? '')
  const lines = text.split('\n')

  let maxLineWidth = 0
  let totalHeight = 0

  for (const line of lines) {
    const lineWidth = line.length * CHAR_WIDTH
    const wrappedLines = Math.ceil(lineWidth / MAX_WIDTH) || 1
    maxLineWidth = Math.max(maxLineWidth, Math.min(lineWidth, MAX_WIDTH))
    totalHeight += wrappedLines * LINE_HEIGHT
  }

  const width = Math.max(120, maxLineWidth + PADDING * 2)
  const readonlyHeight = Math.max(48, totalHeight + PADDING * 2)
  const editHeight = Math.max(80, totalHeight + PADDING * 2 + 40)

  return {
    readonly: { width, height: readonlyHeight },
    edit: { width, height: editHeight }
  }
}

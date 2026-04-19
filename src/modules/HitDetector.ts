import type { BoundingBoxMap, TokenId, PlacedStamp } from '../types'

function isPointInSilhouette(px: number, py: number, stamp: PlacedStamp): boolean {
  const dx = px - stamp.cx
  const dy = py - stamp.cy
  const cos = Math.cos(-stamp.angle)
  const sin = Math.sin(-stamp.angle)
  const rx = dx * cos - dy * sin
  const ry = dx * sin + dy * cos
  const sx = rx / stamp.shapeDef.finalScale
  const sy = ry / stamp.shapeDef.finalScale
  const { size, bitmask } = stamp.shapeDef
  const lx = Math.floor(sx + size / 2)
  const ly = Math.floor(sy + size / 2)
  if (lx >= 0 && lx < size && ly >= 0 && ly < size) {
    return bitmask[ly * size + lx] === 1
  }
  return false
}

export function detectHits(
  stamp: PlacedStamp,
  boundingBoxes: BoundingBoxMap,
  panelRect: DOMRect,
  panelScrollTop: number,
): TokenId[] {
  const hits: TokenId[] = []

  for (const [tokenId, domRect] of Object.entries(boundingBoxes)) {
    // Convert viewport DOMRect to panel content coordinates
    const L = domRect.left - panelRect.left
    const T = domRect.top - panelRect.top + panelScrollTop
    const R = L + domRect.width
    const B = T + domRect.height
    const boxCx = (L + R) / 2
    const boxCy = (T + B) / 2

    const points: [number, number][] = [
      [L, T], [boxCx, T], [R, T],
      [L, boxCy], [boxCx, boxCy], [R, boxCy],
      [L, B], [boxCx, B], [R, B],
    ]

    let hitCount = 0
    for (const [px, py] of points) {
      if (isPointInSilhouette(px, py, stamp)) hitCount++
    }

    if (hitCount >= 5) hits.push(tokenId as TokenId)
  }

  return hits
}

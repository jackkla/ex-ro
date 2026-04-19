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

// panelRect = articleRef.current.getBoundingClientRect() at time of placement.
// Stamp positions (cx/cy) are panel-content-relative (viewport coords minus panel origin).
// domRect entries are viewport-relative from the same getBoundingClientRect call,
// so subtracting panelRect.left/top converts them to the same content space.
export function detectHits(
  stamp: PlacedStamp,
  boundingBoxes: BoundingBoxMap,
  panelRect: DOMRect,
): TokenId[] {
  const hits: TokenId[] = []

  for (const [tokenId, domRect] of Object.entries(boundingBoxes)) {
    const L = domRect.left - panelRect.left
    const T = domRect.top  - panelRect.top
    const R = L + domRect.width
    const B = T + domRect.height
    const bx = (L + R) / 2
    const by = (T + B) / 2

    const points: [number, number][] = [
      [L, T], [bx, T], [R, T],
      [L, by], [bx, by], [R, by],
      [L, B], [bx, B], [R, B],
    ]

    let hits_ = 0
    for (const [px, py] of points) {
      if (isPointInSilhouette(px, py, stamp)) hits_++
    }
    if (hits_ >= 5) hits.push(tokenId as TokenId)
  }

  return hits
}

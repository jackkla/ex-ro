import type { StampShape, BoundingBoxMap, TokenId } from '../types'

type Point = [number, number]

function cubicBezierPoint(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

function quadBezierPoint(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t
  return u * u * p0 + 2 * u * t * p1 + t * t * p2
}

// Parse SVG path into an approximate polygon by sampling key points and curve segments
function svgPathToPolygon(d: string, samplesPerCurve = 8): Point[] {
  const points: Point[] = []
  let cx = 0, cy = 0
  let subpathStart: Point = [0, 0]

  const CMD_RE = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let match: RegExpExecArray | null

  while ((match = CMD_RE.exec(d)) !== null) {
    const cmd = match[1]
    const nums = (match[2].match(/-?[0-9]*\.?[0-9]+(?:e[-+]?[0-9]+)?/gi) ?? []).map(Number)
    let i = 0

    switch (cmd) {
      case 'M':
        while (i + 1 < nums.length) {
          cx = nums[i++]; cy = nums[i++]
          subpathStart = [cx, cy]
          points.push([cx, cy])
        }
        break
      case 'm':
        while (i + 1 < nums.length) {
          cx += nums[i++]; cy += nums[i++]
          subpathStart = [cx, cy]
          points.push([cx, cy])
        }
        break
      case 'L':
        while (i + 1 < nums.length) {
          cx = nums[i++]; cy = nums[i++]
          points.push([cx, cy])
        }
        break
      case 'l':
        while (i + 1 < nums.length) {
          cx += nums[i++]; cy += nums[i++]
          points.push([cx, cy])
        }
        break
      case 'H':
        while (i < nums.length) { cx = nums[i++]; points.push([cx, cy]) }
        break
      case 'h':
        while (i < nums.length) { cx += nums[i++]; points.push([cx, cy]) }
        break
      case 'V':
        while (i < nums.length) { cy = nums[i++]; points.push([cx, cy]) }
        break
      case 'v':
        while (i < nums.length) { cy += nums[i++]; points.push([cx, cy]) }
        break
      case 'C':
        while (i + 5 < nums.length) {
          const x1 = nums[i++], y1 = nums[i++]
          const x2 = nums[i++], y2 = nums[i++]
          const ex = nums[i++], ey = nums[i++]
          for (let s = 1; s <= samplesPerCurve; s++) {
            const t = s / samplesPerCurve
            points.push([
              cubicBezierPoint(cx, x1, x2, ex, t),
              cubicBezierPoint(cy, y1, y2, ey, t),
            ])
          }
          cx = ex; cy = ey
        }
        break
      case 'c':
        while (i + 5 < nums.length) {
          const x1 = cx + nums[i++], y1 = cy + nums[i++]
          const x2 = cx + nums[i++], y2 = cy + nums[i++]
          const ex = cx + nums[i++], ey = cy + nums[i++]
          for (let s = 1; s <= samplesPerCurve; s++) {
            const t = s / samplesPerCurve
            points.push([
              cubicBezierPoint(cx, x1, x2, ex, t),
              cubicBezierPoint(cy, y1, y2, ey, t),
            ])
          }
          cx = ex; cy = ey
        }
        break
      case 'Q':
        while (i + 3 < nums.length) {
          const qx = nums[i++], qy = nums[i++]
          const ex = nums[i++], ey = nums[i++]
          for (let s = 1; s <= samplesPerCurve; s++) {
            const t = s / samplesPerCurve
            points.push([quadBezierPoint(cx, qx, ex, t), quadBezierPoint(cy, qy, ey, t)])
          }
          cx = ex; cy = ey
        }
        break
      case 'q':
        while (i + 3 < nums.length) {
          const qx = cx + nums[i++], qy = cy + nums[i++]
          const ex = cx + nums[i++], ey = cy + nums[i++]
          for (let s = 1; s <= samplesPerCurve; s++) {
            const t = s / samplesPerCurve
            points.push([quadBezierPoint(cx, qx, ex, t), quadBezierPoint(cy, qy, ey, t)])
          }
          cx = ex; cy = ey
        }
        break
      case 'Z':
      case 'z':
        points.push([...subpathStart])
        cx = subpathStart[0]; cy = subpathStart[1]
        break
    }
  }

  return points
}

// Ray-casting point-in-polygon
function pointInPolygon(px: number, py: number, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function detectHits(
  stampShape: StampShape,
  stampX: number,
  stampY: number,
  stampScale: number,
  boundingBoxes: BoundingBoxMap,
  containerRect: DOMRect,
): TokenId[] {
  const entries = Object.entries(boundingBoxes)
  if (entries.length === 0) return []

  // Compute the same pixel size StampCursorAnimator uses
  const pixelSize = Math.sqrt(stampShape.area * stampScale)
  const svgScale = pixelSize / Math.max(stampShape.naturalWidth, stampShape.naturalHeight)
  const halfW = stampShape.naturalWidth / 2
  const halfH = stampShape.naturalHeight / 2

  const rawPoints = svgPathToPolygon(stampShape.svgPath, 8)
  if (rawPoints.length < 3) return []

  // Transform polygon points from SVG space → container-relative pixels
  const polygon: Point[] = rawPoints.map(([x, y]) => [
    (x - halfW) * svgScale + stampX,
    (y - halfH) * svgScale + stampY,
  ])

  const hits: TokenId[] = []

  for (const [tokenId, domRect] of entries) {
    // Convert DOMRect (viewport coords) → container-relative coords
    const left = domRect.left - containerRect.left
    const top = domRect.top - containerRect.top
    const right = left + domRect.width
    const bottom = top + domRect.height

    const corners: Point[] = [[left, top], [right, top], [right, bottom], [left, bottom]]

    // A token is "hit" only when the stamp fully surrounds its bounding box
    if (corners.every(([px, py]) => pointInPolygon(px, py, polygon))) {
      hits.push(tokenId as TokenId)
    }
  }

  return hits
}

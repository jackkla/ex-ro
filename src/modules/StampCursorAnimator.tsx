import React, { useEffect, useRef, useState } from 'react'
import type { StampShape } from '../types'

export type CursorAnimatorProps = {
  shape: StampShape
  containerRef: React.RefObject<HTMLElement>
  pixelsPerAreaUnit: number
  onMouseMove?: (x: number, y: number) => void
}

const RPM = 12
const DEG_PER_MS = (RPM * 360) / 60_000

export function StampCursor({ shape, containerRef, pixelsPerAreaUnit, onMouseMove }: CursorAnimatorProps) {
  // Track raw viewport coords so the fixed SVG overlay stays under the mouse
  const [pos, setPos] = useState({ x: -9999, y: -9999 })
  const rotationRef = useRef(0)
  const [rotation, setRotation] = useState(0)
  const lastTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const onMouseMoveRef = useRef(onMouseMove)
  useEffect(() => { onMouseMoveRef.current = onMouseMove })

  // Track mouse position
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prev = container.style.cursor
    container.style.cursor = 'none'

    const handleMove = (e: MouseEvent) => {
      // Store viewport coords for the fixed SVG; report container-relative to caller
      setPos({ x: e.clientX, y: e.clientY })
      const rect = container.getBoundingClientRect()
      onMouseMoveRef.current?.(e.clientX - rect.left, e.clientY - rect.top)
    }

    container.addEventListener('mousemove', handleMove)
    return () => {
      container.removeEventListener('mousemove', handleMove)
      container.style.cursor = prev
    }
  }, [containerRef])

  // Rotation animation
  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current !== null) {
        const delta = time - lastTimeRef.current
        rotationRef.current = (rotationRef.current + delta * DEG_PER_MS) % 360
        setRotation(rotationRef.current)
      }
      lastTimeRef.current = time
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Scale so visual area ≈ shape.area * pixelsPerAreaUnit
  const pixelSize = Math.sqrt(shape.area * pixelsPerAreaUnit)
  const svgScale = pixelSize / Math.max(shape.naturalWidth, shape.naturalHeight)
  const halfW = (shape.naturalWidth / 2) * svgScale
  const halfH = (shape.naturalHeight / 2) * svgScale

  return (
    <svg
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <g transform={`translate(${pos.x}, ${pos.y}) rotate(${rotation})`}>
        <g transform={`translate(${-halfW}, ${-halfH}) scale(${svgScale})`}>
          <path d={shape.svgPath} fill="currentColor" />
        </g>
      </g>
    </svg>
  )
}

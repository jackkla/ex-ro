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
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setPos({ x, y })
      onMouseMoveRef.current?.(x, y)
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
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
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

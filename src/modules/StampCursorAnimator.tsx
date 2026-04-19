import React, { useEffect, useRef, useState } from 'react'
import type { StampShape } from '../types'

export type CursorAnimatorProps = {
  shape: StampShape
  panelRef: React.RefObject<HTMLElement>
  onMouseMove?: (contentX: number, contentY: number) => void
}

const ROT_SPEED = 0.013 // radians per frame at ~60fps

export function StampCursor({ shape, panelRef, onMouseMove }: CursorAnimatorProps) {
  const [pos, setPos] = useState({ x: -9999, y: -9999 })
  const rotRef = useRef(0)
  const [rotation, setRotation] = useState(0)
  const rafRef = useRef<number | undefined>(undefined)
  const onMouseMoveRef = useRef(onMouseMove)
  useEffect(() => { onMouseMoveRef.current = onMouseMove })

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const prev = panel.style.cursor
    panel.style.cursor = 'none'

    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY })
      const rect = panel.getBoundingClientRect()
      onMouseMoveRef.current?.(e.clientX - rect.left, e.clientY - rect.top + panel.scrollTop)
    }
    const handleLeave = () => setPos({ x: -9999, y: -9999 })

    panel.addEventListener('mousemove', handleMove)
    panel.addEventListener('mouseleave', handleLeave)
    return () => {
      panel.removeEventListener('mousemove', handleMove)
      panel.removeEventListener('mouseleave', handleLeave)
      panel.style.cursor = prev
    }
  }, [panelRef])

  useEffect(() => {
    const animate = () => {
      rotRef.current = (rotRef.current + ROT_SPEED) % (Math.PI * 2)
      setRotation(rotRef.current * 180 / Math.PI)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current) }
  }, [])

  const { size, dataURL, finalScale } = shape

  return (
    <svg
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw', height: '100vh',
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <g transform={`translate(${pos.x}, ${pos.y}) rotate(${rotation}) scale(${finalScale})`} opacity={0.4}>
        <image href={dataURL} x={-size / 2} y={-size / 2} width={size} height={size} />
      </g>
    </svg>
  )
}

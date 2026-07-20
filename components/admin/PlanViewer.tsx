'use client'

import { useState, useRef, useCallback } from 'react'

export interface PlanMarker {
  id: string
  x_pct: number
  y_pct: number
  marker_type: 'task' | 'note' | 'photo'
  title: string
  task_id: string | null
}

const MARKER_BG: Record<string, string> = {
  task:  '#C1121F',
  note:  '#ff9f0a',
  photo: '#0a84ff',
}

function MarkerIcon({ type }: { type: string }) {
  if (type === 'task') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    )
  }
  if (type === 'note') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  )
}

export function PlanViewer({
  imageUrl,
  markers,
  addMarkerMode,
  onAddMarker,
  onMarkerClick,
}: {
  imageUrl: string
  markers: PlanMarker[]
  addMarkerMode: boolean
  onAddMarker: (x: number, y: number) => void
  onMarkerClick: (m: PlanMarker) => void
}) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    draggingRef.current = true
    movedRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true
    setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy })
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const wasDragging = draggingRef.current
    draggingRef.current = false
    if (!wasDragging) return
    if (!movedRef.current && addMarkerMode && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
      onAddMarker(x, y)
    }
  }, [addMarkerMode, onAddMarker])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.88 : 1.14
    setZoom(z => Math.max(0.3, Math.min(5, z * factor)))
  }, [])

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const cursor = addMarkerMode ? 'crosshair' : (draggingRef.current ? 'grabbing' : 'grab')

  return (
    <div
      className="relative bg-[#080808] rounded-card overflow-hidden select-none"
      style={{ height: 480, cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { draggingRef.current = false }}
      onWheel={handleWheel}
    >
      {/* Transform layer */}
      <div
        style={{
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          top: '50%',
          left: '50%',
        }}
      >
        {/* Image + markers positioned relative to image */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Floor plan"
            style={{ display: 'block', maxWidth: 700, maxHeight: 440, userSelect: 'none', pointerEvents: 'none' }}
            draggable={false}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {/* Markers */}
          {markers.map(m => (
            <div
              key={m.id}
              style={{
                position: 'absolute',
                left: `${m.x_pct}%`,
                top: `${m.y_pct}%`,
                transform: 'translate(-50%, -100%)',
                zIndex: 10,
                pointerEvents: 'auto',
              }}
              onClick={e => {
                e.stopPropagation()
                if (!movedRef.current) onMarkerClick(m)
              }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-110 transition-transform"
                style={{
                  background: MARKER_BG[m.marker_type] ?? '#C1121F',
                  boxShadow: `0 2px 8px ${MARKER_BG[m.marker_type] ?? '#C1121F'}80`,
                }}
                title={m.title}
              >
                <MarkerIcon type={m.marker_type} />
              </div>
              {/* Pin stem */}
              <div
                style={{
                  width: 2,
                  height: 6,
                  background: MARKER_BG[m.marker_type] ?? '#C1121F',
                  margin: '0 auto',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-20">
        <button
          onClick={e => { e.stopPropagation(); setZoom(z => Math.min(5, z * 1.3)) }}
          className="w-8 h-8 rounded-button bg-surface/80 border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-secondary hover:text-primary backdrop-blur-sm transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          onClick={e => { e.stopPropagation(); setZoom(z => Math.max(0.3, z * 0.77)) }}
          className="w-8 h-8 rounded-button bg-surface/80 border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-secondary hover:text-primary backdrop-blur-sm transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          onClick={e => { e.stopPropagation(); resetView() }}
          className="w-8 h-8 rounded-button bg-surface/80 border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-secondary hover:text-primary backdrop-blur-sm transition-colors text-[11px] font-bold"
          title="Reset view"
        >
          ↺
        </button>
      </div>

      {/* Zoom badge */}
      <div className="absolute bottom-3 left-3 z-20 bg-surface/70 border border-[rgba(255,255,255,0.08)] rounded-button px-2 py-1 text-[11px] text-secondary backdrop-blur-sm">
        {Math.round(zoom * 100)}%
      </div>

      {/* Add-marker hint */}
      {addMarkerMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-brand/90 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm shadow-lg">
          Click anywhere on the plan to place a marker
        </div>
      )}
    </div>
  )
}

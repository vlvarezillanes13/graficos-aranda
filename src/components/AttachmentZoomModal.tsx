import { useCallback, useEffect, useRef, useState } from 'react'
import type { PreviewKind } from '../services/attachmentService'

interface AttachmentZoomModalProps {
  name: string
  url: string
  kind: PreviewKind
  onClose: () => void
}

const MIN_SCALE = 0.5
const MAX_SCALE = 6
const SCALE_STEP = 0.25

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export function AttachmentZoomModal({
  name,
  url,
  kind,
  onClose,
}: AttachmentZoomModalProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragOrigin = useRef({ x: 0, y: 0, originX: 0, originY: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const scaleRef = useRef(scale)
  const positionRef = useRef(position)

  scaleRef.current = scale
  positionRef.current = position

  const clampPosition = useCallback((x: number, y: number, nextScale: number) => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image || !image.naturalWidth || !image.naturalHeight) {
      return { x, y }
    }

    const { width: canvasW, height: canvasH } = canvas.getBoundingClientRect()
    const fit = Math.min(
      canvasW / image.naturalWidth,
      canvasH / image.naturalHeight,
      1,
    )
    const displayW = image.naturalWidth * fit * nextScale
    const displayH = image.naturalHeight * fit * nextScale
    const maxX = Math.max(0, (displayW - canvasW) / 2)
    const maxY = Math.max(0, (displayH - canvasH) / 2)

    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }, [])

  const applyScale = useCallback(
    (nextScale: number) => {
      const clamped = clampScale(nextScale)
      setScale(clamped)
      setPosition((current) =>
        clamped <= 1 ? { x: 0, y: 0 } : clampPosition(current.x, current.y, clamped),
      )
    },
    [clampPosition],
  )

  const zoomIn = () => applyScale(scale + SCALE_STEP)
  const zoomOut = () => applyScale(scale - SCALE_STEP)
  const resetView = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (kind !== 'image') return

      event.preventDefault()
      const direction = event.deltaY < 0 ? 1 : -1
      applyScale(scaleRef.current + direction * SCALE_STEP)
    },
    [applyScale, kind],
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (kind !== 'image' || scaleRef.current <= 1) return
    if (event.button !== 0) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    isDraggingRef.current = true
    setIsDragging(true)
    dragOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      originX: positionRef.current.x,
      originY: positionRef.current.y,
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return

    event.preventDefault()
    const next = {
      x: dragOrigin.current.originX + (event.clientX - dragOrigin.current.x),
      y: dragOrigin.current.originY + (event.clientY - dragOrigin.current.y),
    }
    setPosition(clampPosition(next.x, next.y, scaleRef.current))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return

    isDraggingRef.current = false
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || kind !== 'image') return

    const preventScroll = (event: WheelEvent) => {
      event.preventDefault()
    }

    canvas.addEventListener('wheel', preventScroll, { passive: false })
    return () => canvas.removeEventListener('wheel', preventScroll)
  }, [kind])

  const canPan = kind === 'image' && scale > 1

  return (
    <div
      className="attachment-zoom-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="attachment-zoom-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Vista ampliada: ${name}`}
      >
        <header className="attachment-zoom-header">
          <strong className="attachment-zoom-title">{name}</strong>

          <div className="attachment-zoom-actions">
            {kind === 'image' && (
              <>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={zoomOut}
                  aria-label="Alejar"
                >
                  −
                </button>
                <span className="attachment-zoom-scale">{Math.round(scale * 100)}%</span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={zoomIn}
                  aria-label="Acercar"
                >
                  +
                </button>
                <button type="button" className="ghost-button" onClick={resetView}>
                  Restablecer
                </button>
              </>
            )}

            <a href={url} download={name} className="ghost-button">
              Descargar
            </a>
            <button type="button" className="ghost-button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </header>

        <div className="attachment-zoom-body">
          {kind === 'image' && (
            <div
              ref={canvasRef}
              className={`attachment-zoom-canvas${canPan ? ' can-pan' : ''}${isDragging ? ' is-dragging' : ''}`}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div
                className="attachment-zoom-layer"
                style={{
                  transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
                }}
              >
                <img
                  ref={imageRef}
                  src={url}
                  alt={name}
                  className="attachment-zoom-image"
                  draggable={false}
                />
              </div>
            </div>
          )}

          {kind === 'pdf' && (
            <embed
              src={url}
              type="application/pdf"
              title={name}
              className="attachment-zoom-frame"
            />
          )}

          {kind === 'text' && (
            <iframe
              src={url}
              title={name}
              className="attachment-zoom-frame"
            />
          )}

          {kind === 'unsupported' && (
            <div className="attachment-zoom-fallback">
              <p>Vista previa no disponible para este tipo de archivo.</p>
              <a href={url} download={name} className="ghost-button">
                Descargar {name}
              </a>
            </div>
          )}
        </div>

        {kind === 'image' && (
          <p className="attachment-zoom-hint">
            Usa la rueda del mouse o los botones +/− para hacer zoom. Con zoom activo, arrastra para
            recorrer la imagen.
          </p>
        )}

        {kind === 'pdf' && (
          <p className="attachment-zoom-hint">
            Usa los controles del visor PDF del navegador para acercar o alejar.
          </p>
        )}
      </div>
    </div>
  )
}

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

export function AttachmentZoomModal({
  name,
  url,
  kind,
  onClose,
}: AttachmentZoomModalProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOrigin = useRef({ x: 0, y: 0, originX: 0, originY: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  const clampScale = (value: number) =>
    Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

  const zoomIn = () => setScale((current) => clampScale(current + SCALE_STEP))
  const zoomOut = () => setScale((current) => clampScale(current - SCALE_STEP))
  const resetView = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (kind !== 'image') return

    event.preventDefault()
    const direction = event.deltaY < 0 ? 1 : -1
    setScale((current) => clampScale(current + direction * SCALE_STEP))
  }, [kind])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (kind !== 'image' || scale <= 1) return

    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    dragOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      originX: position.x,
      originY: position.y,
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return

    setPosition({
      x: dragOrigin.current.originX + (event.clientX - dragOrigin.current.x),
      y: dragOrigin.current.originY + (event.clientY - dragOrigin.current.y),
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    setIsDragging(false)
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
              className={`attachment-zoom-canvas${isDragging ? ' is-dragging' : ''}`}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={url}
                alt={name}
                className="attachment-zoom-image"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                }}
                draggable={false}
              />
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
            Usa la rueda del mouse o los botones +/− para hacer zoom. Arrastra para mover la imagen.
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

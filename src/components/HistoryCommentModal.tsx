import { useEffect, useState, type MouseEvent } from 'react'
import { AttachmentZoomModal } from './AttachmentZoomModal'

interface HistoryCommentModalProps {
  title: string
  text: string
  html?: string | null
  onClose: () => void
}

export function HistoryCommentModal({
  title,
  text,
  html = null,
  onClose,
}: HistoryCommentModalProps) {
  const [zoom, setZoom] = useState<{ name: string; url: string } | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (zoom) {
          setZoom(null)
          return
        }
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, zoom])

  const handleHtmlClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLImageElement) || !target.src) return
    setZoom({
      name: target.alt?.trim() || 'Imagen del comentario',
      url: target.src,
    })
  }

  return (
    <div
      className="history-comment-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="history-comment-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-comment-title"
      >
        <header className="history-comment-header">
          <h3 id="history-comment-title">{title}</h3>
          <button type="button" className="ghost-button" onClick={onClose}>
            Cerrar
          </button>
        </header>

        {html ? (
          <div
            className="history-comment-body is-html detail-description-html"
            onClick={handleHtmlClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="history-comment-body">{text}</div>
        )}
      </div>

      {zoom && (
        <AttachmentZoomModal
          name={zoom.name}
          url={zoom.url}
          kind="image"
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  )
}

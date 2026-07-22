import { useEffect } from 'react'

interface HistoryCommentModalProps {
  title: string
  text: string
  onClose: () => void
}

export function HistoryCommentModal({
  title,
  text,
  onClose,
}: HistoryCommentModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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

        <div className="history-comment-body">{text}</div>
      </div>
    </div>
  )
}

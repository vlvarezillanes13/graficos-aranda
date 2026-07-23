import { useEffect, useState } from 'react'
import type { IncidentItem } from '../types/incident'
import type { HistoryEntry } from '../types/itemHistory'
import { fetchItemHistory } from '../services/itemHistoryService'
import {
  formatHistoryTimestamp,
  formatHistoryValue,
  getAttachmentFileName,
  getHistoryActionKind,
  getHistoryActionLabel,
  getHistoryCommentText,
  getHistoryDetails,
  getHistorySummary,
  shouldOfferFullHistoryComment,
  sortHistoryEntries,
} from '../utils/itemHistory'
import { HistoryCommentModal } from './HistoryCommentModal'

interface ItemHistorySectionProps {
  item: IncidentItem
  active: boolean
}

function ActionIcon({ kind }: { kind: ReturnType<typeof getHistoryActionKind> }) {
  const icons: Record<typeof kind, string> = {
    note: '💬',
    modification: '✏️',
    attachment: '📎',
    creation: '➕',
    other: '•',
  }

  return <span className="history-icon">{icons[kind]}</span>
}

function HistoryNoteContent({
  entry,
  onOpenFull,
}: {
  entry: HistoryEntry
  onOpenFull: (entry: HistoryEntry, text: string) => void
}) {
  const commentText = getHistoryCommentText(entry)
  if (!commentText) return null

  const showOpenButton = shouldOfferFullHistoryComment(commentText)

  return (
    <div className="history-note-content">
      <div
        className={`history-note-box ${showOpenButton ? 'history-note-preview is-expandable' : ''}`}
        onClick={showOpenButton ? () => onOpenFull(entry, commentText) : undefined}
        onKeyDown={
          showOpenButton
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpenFull(entry, commentText)
                }
              }
            : undefined
        }
        role={showOpenButton ? 'button' : undefined}
        tabIndex={showOpenButton ? 0 : undefined}
      >
        {commentText}
      </div>
      {showOpenButton && (
        <button
          type="button"
          className="history-open-comment-button"
          onClick={() => onOpenFull(entry, commentText)}
        >
          Ver comentario completo
        </button>
      )}
    </div>
  )
}

function HistoryEntryCard({
  entry,
  onOpenComment,
}: {
  entry: HistoryEntry
  onOpenComment: (entry: HistoryEntry, text: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const kind = getHistoryActionKind(entry)
  const label = getHistoryActionLabel(entry)
  const summary = getHistorySummary(entry)
  const commentText = getHistoryCommentText(entry)
  const showNoteContent = kind === 'note' || (kind === 'other' && commentText)

  return (
    <article className="history-entry">
      <button
        type="button"
        className="history-entry-header"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <time className="history-time">{formatHistoryTimestamp(entry.created)}</time>
        <ActionIcon kind={kind} />
        <span className="history-title">
          <span className="history-author">{entry.authorName}</span>{' '}
          <strong>{label}</strong>
        </span>
        <span className={`history-chevron ${expanded ? 'expanded' : ''}`} aria-hidden>
          ▾
        </span>
      </button>

      {expanded && (
        <div className="history-entry-body">
          {!showNoteContent && <p className="history-summary">{summary}</p>}

          {showNoteContent && (
            <HistoryNoteContent entry={entry} onOpenFull={onOpenComment} />
          )}

          {kind === 'attachment' && (
            <div className="history-attachment-box">{getAttachmentFileName(entry)}</div>
          )}

          {(kind === 'modification' || kind === 'creation') &&
            getHistoryDetails(entry).length > 0 && (
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Campo modificado</th>
                    <th>Nuevo valor</th>
                    <th>Valor anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {getHistoryDetails(entry).map((row, index) => (
                    <tr key={`${entry.id}-${row.fieldName}-${index}`}>
                      <td>{row.fieldName}</td>
                      <td>{formatHistoryValue(row, row.newValue)}</td>
                      <td>{formatHistoryValue(row, row.oldValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export function ItemHistorySection({ item, active }: ItemHistorySectionProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedForItemId, setLoadedForItemId] = useState<number | null>(null)
  const [openComment, setOpenComment] = useState<{
    title: string
    text: string
  } | null>(null)

  useEffect(() => {
    setHistory([])
    setError(null)
    setLoadedForItemId(null)
    setOpenComment(null)
  }, [item.id])

  useEffect(() => {
    if (!active || loadedForItemId === item.id) return

    let cancelled = false
    setError(null)
    setLoading(true)

    void fetchItemHistory(item)
      .then((content) => {
        if (!cancelled) {
          setHistory(sortHistoryEntries(content))
          setLoadedForItemId(item.id)
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Error al cargar historial',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [item, active, loadedForItemId])

  const handleOpenComment = (entry: HistoryEntry, text: string) => {
    setOpenComment({
      title: `${entry.authorName} · ${getHistoryActionLabel(entry)}`,
      text,
    })
  }

  return (
    <section className="detail-history">
      {loading && <p className="detail-history-muted">Cargando historial...</p>}
      {error && <p className="detail-history-error">{error}</p>}

      {!loading && !error && history.length === 0 && (
        <p className="detail-history-muted">Este ticket no tiene historial</p>
      )}

      {!loading && !error && history.length > 0 && (
        <>
          <p className="detail-history-meta">
            {history.length} evento{history.length === 1 ? '' : 's'} · más reciente primero
          </p>
          <div className="history-timeline">
            {history.map((entry) => (
              <HistoryEntryCard
                key={entry.id}
                entry={entry}
                onOpenComment={handleOpenComment}
              />
            ))}
          </div>
        </>
      )}

      {openComment && (
        <HistoryCommentModal
          title={openComment.title}
          text={openComment.text}
          onClose={() => setOpenComment(null)}
        />
      )}
    </section>
  )
}

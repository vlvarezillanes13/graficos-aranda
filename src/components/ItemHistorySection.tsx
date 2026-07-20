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
  getHistorySummary,
  sortHistoryEntries,
} from '../utils/itemHistory'

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

function HistoryEntryCard({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(true)
  const kind = getHistoryActionKind(entry)
  const label = getHistoryActionLabel(entry)
  const summary = getHistorySummary(entry)

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
          <p className="history-summary">{summary}</p>

          {kind === 'note' && entry.descriptionNoHtml?.trim() && (
            <div className="history-note-box">{entry.descriptionNoHtml.trim()}</div>
          )}

          {kind === 'attachment' && (
            <div className="history-attachment-box">{getAttachmentFileName(entry)}</div>
          )}

          {(kind === 'modification' || kind === 'creation') && entry.detail.length > 0 && (
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
                  {entry.detail.map((row, index) => (
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

          {kind === 'other' && entry.descriptionNoHtml?.trim() && (
            <div className="history-note-box">{entry.descriptionNoHtml.trim()}</div>
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

  useEffect(() => {
    setHistory([])
    setError(null)
    setLoadedForItemId(null)
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
              <HistoryEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

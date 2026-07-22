import { formatDate } from './aggregations'
import type { HistoryDetail, HistoryEntry } from '../types/itemHistory'

const DATE_FIELD_PATTERN =
  /fecha|date|creado|modific|entrega|estimada|iteraci/i

export function getHistoryActionLabel(entry: HistoryEntry): string {
  switch (entry.actionId) {
    case 1:
      return 'Creó un ítem'
    case 2:
      return 'Modificó un ítem'
    case 5:
      return 'Agregó un archivo adjunto'
    case 24:
      return 'Convirtió el ítem'
    default:
      if (/nota/i.test(entry.actionName)) {
        return entry.actionName.includes('pública')
          ? 'Escribió una nota pública'
          : 'Escribió una nota'
      }
      return entry.actionName
  }
}

export function getHistoryActionKind(
  entry: HistoryEntry,
): 'note' | 'modification' | 'attachment' | 'creation' | 'other' {
  if (entry.actionId === 5 || /archivo/i.test(entry.actionName)) {
    return 'attachment'
  }
  if (/nota/i.test(entry.actionName)) {
    return 'note'
  }
  if (entry.actionId === 1) return 'creation'
  if (entry.detail.length > 0) return 'modification'
  if (entry.descriptionNoHtml?.trim()) return 'note'
  return 'other'
}

export function formatHistoryTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export function formatHistoryValue(
  detail: HistoryDetail,
  value: string | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '—'

  if (detail.dataType === 0 || DATE_FIELD_PATTERN.test(detail.fieldName)) {
    const numeric = Number(value)
    if (!Number.isNaN(numeric) && numeric > 1_000_000_000_000) {
      return formatDate(numeric)
    }
  }

  return stripHtml(value)
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

export function getHistoryCommentText(entry: HistoryEntry): string {
  if (entry.descriptionNoHtml?.trim()) {
    return entry.descriptionNoHtml.trim()
  }

  if (entry.description?.trim()) {
    return stripHtml(entry.description)
  }

  return ''
}

export function shouldOfferFullHistoryComment(text: string): boolean {
  return text.length > 220
}

export function getAttachmentFileName(entry: HistoryEntry): string {
  if (entry.descriptionNoHtml?.trim()) {
    return entry.descriptionNoHtml.trim()
  }

  const fileDetail = entry.detail.find((row) =>
    /file/i.test(row.fieldName),
  )
  if (fileDetail?.newValue) {
    return stripHtml(fileDetail.newValue)
  }

  return 'Archivo adjunto'
}

export function sortHistoryEntries(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) => {
    if (b.created !== a.created) return b.created - a.created
    return b.id - a.id
  })
}

export function getHistorySummary(entry: HistoryEntry): string {
  const kind = getHistoryActionKind(entry)

  if (kind === 'note') {
    const text = getHistoryCommentText(entry)
    return text || 'Nota sin contenido'
  }

  if (kind === 'attachment') {
    return getAttachmentFileName(entry)
  }

  if (kind === 'modification' || kind === 'creation') {
    return entry.detail
      .map((row) => row.fieldName)
      .filter(Boolean)
      .join(', ')
  }

  return entry.descriptionNoHtml?.trim() || entry.actionName
}

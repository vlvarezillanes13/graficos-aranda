import type { IncidentItem } from '../types/incident'

export const ARANDA_URGENTES_KEY = 'ARANDA_URGENTES'

export function parseUrgentCaseIds(raw: string | null): string[] {
  if (!raw?.trim()) return []

  const trimmed = raw.trim()

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => String(value).trim().toUpperCase())
          .filter(Boolean)
      }
    } catch {
      // fall through to delimiter parsing
    }
  }

  return trimmed
    .split(/[;,]/)
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean)
}

export function readUrgentCaseIds(): string[] {
  return parseUrgentCaseIds(sessionStorage.getItem(ARANDA_URGENTES_KEY))
}

export function formatUrgentCaseIds(ids: string[]): string {
  return ids.join('; ')
}

export function writeUrgentCaseIds(ids: string[]): void {
  const normalized = ids
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean)

  if (normalized.length === 0) {
    sessionStorage.removeItem(ARANDA_URGENTES_KEY)
    return
  }

  sessionStorage.setItem(ARANDA_URGENTES_KEY, formatUrgentCaseIds(normalized))
}

export function filterUrgentItems(
  items: IncidentItem[],
  urgentIds: string[],
): IncidentItem[] {
  if (urgentIds.length === 0) return []

  const byId = new Map(
    items.map((item) => [item.idByProject.trim().toUpperCase(), item]),
  )

  return urgentIds
    .map((id) => byId.get(id))
    .filter((item): item is IncidentItem => item !== undefined)
}

export function getMissingUrgentIds(
  items: IncidentItem[],
  urgentIds: string[],
): string[] {
  if (urgentIds.length === 0) return []

  const loadedIds = new Set(
    items.map((item) => item.idByProject.trim().toUpperCase()),
  )

  return urgentIds.filter((id) => !loadedIds.has(id))
}

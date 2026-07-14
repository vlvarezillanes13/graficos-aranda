import type { IncidentItem } from '../types/incident'

export const URGENT_CASES_KEY = 'graficos_urgent_cases'
const LEGACY_URGENT_CASES_KEY = 'ARANDA_URGENTES'

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
  const raw =
    sessionStorage.getItem(URGENT_CASES_KEY) ??
    sessionStorage.getItem(LEGACY_URGENT_CASES_KEY)

  return parseUrgentCaseIds(raw)
}

export function formatUrgentCaseIds(ids: string[]): string {
  return ids.join('; ')
}

export function writeUrgentCaseIds(ids: string[]): void {
  const normalized = ids
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean)

  if (normalized.length === 0) {
    sessionStorage.removeItem(URGENT_CASES_KEY)
    sessionStorage.removeItem(LEGACY_URGENT_CASES_KEY)
    return
  }

  sessionStorage.setItem(URGENT_CASES_KEY, formatUrgentCaseIds(normalized))
  sessionStorage.removeItem(LEGACY_URGENT_CASES_KEY)
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

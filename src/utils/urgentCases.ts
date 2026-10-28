import type { IncidentItem } from '../types/incident'
import {
  entriesToFrentes,
  entriesToIds,
  formatStabilizationEntries,
  normalizeTicketId,
  parseStabilizationInput,
  type FrenteMap,
} from './stabilizationCases'

export const URGENT_CASES_KEY = 'graficos_urgent_cases'
const LEGACY_URGENT_CASES_KEY = 'ARANDA_URGENTES'
export const STABILIZATION_CASES_KEY = 'graficos_stabilization_cases'

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

/**
 * La caché de sesión usa el mismo texto `ID|FRENTE; ID2`; las cachés antiguas
 * (`ID; ID2` o arreglo JSON) se leen sin frente.
 */
export function readStabilizationCases(): {
  ids: string[]
  frentes: FrenteMap
} {
  const { entries } = parseStabilizationInput(
    sessionStorage.getItem(STABILIZATION_CASES_KEY),
  )
  return { ids: entriesToIds(entries), frentes: entriesToFrentes(entries) }
}

export function readStabilizationCaseIds(): string[] {
  return readStabilizationCases().ids
}

export function writeStabilizationCases(
  ids: string[],
  frentes: FrenteMap = {},
): void {
  const normalized = ids.map(normalizeTicketId).filter(Boolean)

  if (normalized.length === 0) {
    sessionStorage.removeItem(STABILIZATION_CASES_KEY)
    return
  }

  sessionStorage.setItem(
    STABILIZATION_CASES_KEY,
    formatStabilizationEntries(normalized, frentes),
  )
}

export function writeStabilizationCaseIds(ids: string[]): void {
  writeStabilizationCases(ids)
}

export const filterStabilizationItems = filterUrgentItems
export const getMissingStabilizationIds = getMissingUrgentIds

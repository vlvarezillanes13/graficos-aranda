/**
 * Casos de estabilización: cada ticket puede tener un "frente" asociado.
 *
 * Formato de entrada (retrocompatible con el anterior `ID1; ID2`):
 *   RF-9155057|BYP;RF-9059887|RN;RF-9056222|CRP
 *   RF-9155057|BYP;RF-9059887;RF-9056222|RN   (formatos mezclados)
 *   uno por línea también es válido.
 *
 * Reglas:
 * - Separadores de registro: `;`, `,` (formato histórico) y saltos de línea.
 * - Separador ticket/frente: `|` (solo uno por registro).
 * - El ticket se normaliza a MAYÚSCULAS y sin espacios en los extremos.
 * - El frente es opcional, texto libre; se recortan espacios y se conserva el
 *   texto tal como se escribió. Sin frente => cadena vacía (nunca "N/A", etc.).
 * - Tickets repetidos se fusionan: conservan la posición de su primera
 *   aparición y el frente final es el último frente no vacío informado.
 */

export type FrenteMap = Record<string, string>

export interface StabilizationEntry {
  id: string
  frente: string
}

export interface ParseStabilizationResult {
  entries: StabilizationEntry[]
  errors: string[]
}

export const MAX_FRENTE_LENGTH = 100

const RECORD_SEPARATOR = /[;,\r\n]+/
const FRENTE_FORBIDDEN_CHARS = /[|;,\r\n]+/g

export function normalizeTicketId(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

export function normalizeFrente(value: unknown): string {
  if (typeof value !== 'string') return ''

  return value
    .replace(FRENTE_FORBIDDEN_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FRENTE_LENGTH)
    .trim()
}

function mergeEntries(entries: StabilizationEntry[]): StabilizationEntry[] {
  const byId = new Map<string, StabilizationEntry>()

  for (const entry of entries) {
    const id = normalizeTicketId(entry.id)
    if (!id) continue

    const frente = normalizeFrente(entry.frente)
    const existing = byId.get(id)

    if (!existing) {
      byId.set(id, { id, frente })
      continue
    }

    if (frente) existing.frente = frente
  }

  return Array.from(byId.values())
}

function parseJsonEntries(trimmed: string): StabilizationEntry[] | null {
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!Array.isArray(parsed)) return null

    const entries: StabilizationEntry[] = []
    for (const value of parsed) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>
        entries.push({
          id: normalizeTicketId(record.id),
          frente: normalizeFrente(record.frente),
        })
        continue
      }
      entries.push({ id: normalizeTicketId(value), frente: '' })
    }
    return mergeEntries(entries)
  } catch {
    return null
  }
}

export function parseStabilizationInput(
  raw: string | null | undefined,
): ParseStabilizationResult {
  if (!raw?.trim()) return { entries: [], errors: [] }

  const trimmed = raw.trim()

  if (trimmed.startsWith('[')) {
    const fromJson = parseJsonEntries(trimmed)
    if (fromJson) return { entries: fromJson, errors: [] }
  }

  const entries: StabilizationEntry[] = []
  const errors: string[] = []

  for (const rawSegment of trimmed.split(RECORD_SEPARATOR)) {
    const segment = rawSegment.trim()
    if (!segment) continue

    const pipeIndex = segment.indexOf('|')

    if (pipeIndex < 0) {
      entries.push({ id: segment, frente: '' })
      continue
    }

    const id = segment.slice(0, pipeIndex).trim()
    const frente = segment.slice(pipeIndex + 1)

    if (frente.includes('|')) {
      errors.push(
        `"${segment}": solo se permite un separador "|" entre ticket y frente`,
      )
      continue
    }

    if (!id) {
      errors.push(`"${segment}": falta el ticket antes de "|"`)
      continue
    }

    entries.push({ id, frente })
  }

  return { entries: mergeEntries(entries), errors }
}

export function entriesToIds(entries: StabilizationEntry[]): string[] {
  return entries.map((entry) => entry.id)
}

/** Solo incluye tickets con frente informado (vacío = sin clave). */
export function entriesToFrentes(entries: StabilizationEntry[]): FrenteMap {
  const frentes: FrenteMap = {}
  for (const entry of entries) {
    if (entry.frente) frentes[entry.id] = entry.frente
  }
  return frentes
}

/**
 * Limpia un mapa ticket->frente: claves en MAYÚSCULAS, frentes recortados,
 * descarta vacíos y (si se indican `ids`) tickets que no estén en la lista.
 */
export function normalizeFrenteMap(raw: unknown, ids?: string[]): FrenteMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const allowed = ids ? new Set(ids.map(normalizeTicketId)) : null
  const frentes: FrenteMap = {}

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = normalizeTicketId(key)
    if (!id || (allowed && !allowed.has(id))) continue

    const frente = normalizeFrente(value)
    if (frente) frentes[id] = frente
  }

  return frentes
}

export function sameFrenteMap(a: FrenteMap, b: FrenteMap): boolean {
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) return false
  return aKeys.every((key) => a[key] === b[key])
}

export function getFrente(
  frentes: FrenteMap | undefined,
  ticketId: string | null | undefined,
): string {
  if (!frentes) return ''
  return frentes[normalizeTicketId(ticketId)] ?? ''
}

/** Texto para el textarea / caché: `ID|FRENTE; ID2; ID3|FRENTE`. */
export function formatStabilizationEntries(
  ids: string[],
  frentes?: FrenteMap,
): string {
  return ids
    .map((id) => {
      const frente = getFrente(frentes, id)
      return frente ? `${id}|${frente}` : id
    })
    .join('; ')
}

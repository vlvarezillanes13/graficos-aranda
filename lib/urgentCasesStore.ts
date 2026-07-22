import { readStorageJson, writeStorageJson } from './serverStorage.js'

const STORAGE_KEY = 'graficos:urgent-cases'

export interface UrgentCasesState {
  urgentIds: string[]
  actualizadoPor: string | null
  actualizadoEn: string | null
  version: number
}

const EMPTY_STATE: UrgentCasesState = {
  urgentIds: [],
  actualizadoPor: null,
  actualizadoEn: null,
  version: 0,
}

function normalizeUrgentIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const value of raw) {
    const id = String(value ?? '')
      .trim()
      .toUpperCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }

  return normalized
}

export async function getUrgentCasesState(): Promise<UrgentCasesState> {
  const stored = await readStorageJson<UrgentCasesState>(STORAGE_KEY)
  if (!stored) return { ...EMPTY_STATE }

  return {
    urgentIds: normalizeUrgentIds(stored.urgentIds),
    actualizadoPor: stored.actualizadoPor ?? null,
    actualizadoEn: stored.actualizadoEn ?? null,
    version: typeof stored.version === 'number' ? stored.version : 0,
  }
}

export async function updateUrgentCasesState(
  urgentIds: unknown,
  usuario: string,
): Promise<UrgentCasesState> {
  const current = await getUrgentCasesState()
  const next: UrgentCasesState = {
    urgentIds: normalizeUrgentIds(urgentIds),
    actualizadoPor: usuario.trim() || 'Usuario',
    actualizadoEn: new Date().toISOString(),
    version: current.version + 1,
  }

  await writeStorageJson(STORAGE_KEY, next)
  return next
}

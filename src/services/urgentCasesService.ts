import { getAuthHeaders } from './authService'

export interface SharedUrgentState {
  urgentIds: string[]
  actualizadoPor: string | null
  actualizadoEn: string | null
  version: number
  edicionBloqueada: boolean
}

export class UrgentCasesLockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrgentCasesLockedError'
  }
}

const POLL_INTERVAL_MS = 5000

function asRecord(data: unknown): Record<string, unknown> | null {
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
}

function normalizeSharedState(data: unknown): SharedUrgentState {
  const record = asRecord(data) ?? {}
  const urgentIds = Array.isArray(record.urgentIds)
    ? record.urgentIds.map((id) => String(id))
    : []

  return {
    urgentIds,
    actualizadoPor:
      typeof record.actualizadoPor === 'string' ? record.actualizadoPor : null,
    actualizadoEn:
      typeof record.actualizadoEn === 'string' ? record.actualizadoEn : null,
    version: typeof record.version === 'number' ? record.version : 0,
    edicionBloqueada: record.edicionBloqueada !== false,
  }
}

async function parseUrgentError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const data = await response.json().catch(() => null)
  const record = asRecord(data)
  const message =
    record && typeof record.error === 'string' ? record.error : fallback

  if (response.status === 403) {
    return new UrgentCasesLockedError(message)
  }

  return new Error(message)
}

export async function fetchSharedUrgentState(): Promise<SharedUrgentState> {
  const response = await fetch('/api/urgent-cases', {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw await parseUrgentError(
      response,
      `Error al cargar urgentes (${response.status})`,
    )
  }

  return normalizeSharedState(await response.json().catch(() => null))
}

export async function saveSharedUrgentState(
  urgentIds: string[],
  usuario: string,
): Promise<SharedUrgentState> {
  const response = await fetch('/api/urgent-cases', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ urgentIds, usuario }),
  })

  if (!response.ok) {
    throw await parseUrgentError(
      response,
      'No fue posible actualizar la lista de urgentes',
    )
  }

  return normalizeSharedState(await response.json().catch(() => null))
}

export async function setSharedUrgentEditLock(
  edicionBloqueada: boolean,
  usuario: string,
): Promise<SharedUrgentState> {
  const response = await fetch('/api/urgent-cases', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ edicionBloqueada, usuario }),
  })

  if (!response.ok) {
    throw await parseUrgentError(
      response,
      'No fue posible cambiar el bloqueo de urgentes',
    )
  }

  return normalizeSharedState(await response.json().catch(() => null))
}

export { POLL_INTERVAL_MS as URGENT_CASES_POLL_MS }

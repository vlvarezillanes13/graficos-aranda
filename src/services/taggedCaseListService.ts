import { getAuthHeaders } from './authService'

export type TaggedCaseKind = 'urgent' | 'stabilization'

export interface SharedTaggedCasesState {
  caseIds: string[]
  actualizadoPor: string | null
  actualizadoEn: string | null
  version: number
  edicionBloqueada: boolean
  claveConfigurada: boolean
}

export class TaggedCasesLockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaggedCasesLockedError'
  }
}

export class TaggedCasesKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaggedCasesKeyError'
  }
}

const POLL_INTERVAL_MS = 5000

const LIST_ENDPOINTS: Record<TaggedCaseKind, string> = {
  urgent: '/api/urgent-cases',
  stabilization: '/api/stabilization-cases',
}

const LIST_ID_FIELDS: Record<TaggedCaseKind, 'urgentIds' | 'stabilizationIds'> = {
  urgent: 'urgentIds',
  stabilization: 'stabilizationIds',
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return data as Record<string, unknown>
}

function normalizeSharedState(
  kind: TaggedCaseKind,
  data: unknown,
): SharedTaggedCasesState {
  const record = asRecord(data) ?? {}
  const idsField = LIST_ID_FIELDS[kind]
  const rawIds = record[idsField]
  const caseIds = Array.isArray(rawIds)
    ? rawIds.map((id) => String(id))
    : Array.isArray(record.caseIds)
      ? record.caseIds.map((id) => String(id))
      : []

  return {
    caseIds,
    actualizadoPor:
      typeof record.actualizadoPor === 'string' ? record.actualizadoPor : null,
    actualizadoEn:
      typeof record.actualizadoEn === 'string' ? record.actualizadoEn : null,
    version: typeof record.version === 'number' ? record.version : 0,
    edicionBloqueada: record.edicionBloqueada !== false,
    claveConfigurada: record.claveConfigurada === true,
  }
}

async function parseTaggedError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const data = await response.json().catch(() => null)
  const record = asRecord(data)
  const message =
    record && typeof record.error === 'string' ? record.error : fallback

  if (response.status === 403) {
    if (
      message.toLowerCase().includes('clave') ||
      message.toLowerCase().includes('equipo')
    ) {
      return new TaggedCasesKeyError(message)
    }
    return new TaggedCasesLockedError(message)
  }

  return new Error(message)
}

export async function fetchSharedTaggedCasesState(
  kind: TaggedCaseKind,
): Promise<SharedTaggedCasesState> {
  const response = await fetch(LIST_ENDPOINTS[kind], {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw await parseTaggedError(
      response,
      `Error al cargar ${kind === 'urgent' ? 'urgentes' : 'estabilización'} (${response.status})`,
    )
  }

  return normalizeSharedState(kind, await response.json().catch(() => null))
}

export async function saveSharedTaggedCasesState(
  kind: TaggedCaseKind,
  caseIds: string[],
  usuario: string,
): Promise<SharedTaggedCasesState> {
  const response = await fetch(LIST_ENDPOINTS[kind], {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      [LIST_ID_FIELDS[kind]]: caseIds,
      usuario,
    }),
  })

  if (!response.ok) {
    throw await parseTaggedError(
      response,
      `No fue posible actualizar la lista de ${kind === 'urgent' ? 'urgentes' : 'estabilización'}`,
    )
  }

  return normalizeSharedState(kind, await response.json().catch(() => null))
}

export async function setSharedTaggedCasesEditLock(
  kind: TaggedCaseKind,
  edicionBloqueada: boolean,
  usuario: string,
): Promise<SharedTaggedCasesState> {
  const response = await fetch(LIST_ENDPOINTS[kind], {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ edicionBloqueada, usuario }),
  })

  if (!response.ok) {
    throw await parseTaggedError(
      response,
      `No fue posible cambiar el bloqueo de ${kind === 'urgent' ? 'urgentes' : 'estabilización'}`,
    )
  }

  return normalizeSharedState(kind, await response.json().catch(() => null))
}

export async function setSharedTaggedCasesUnlockKey(
  kind: TaggedCaseKind,
  claveHash: string,
): Promise<void> {
  const response = await fetch(LIST_ENDPOINTS[kind], {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accion: 'definir-clave',
      clave: claveHash,
    }),
  })

  if (!response.ok) {
    throw await parseTaggedError(
      response,
      `No fue posible guardar la clave de ${kind === 'urgent' ? 'urgentes' : 'estabilización'}`,
    )
  }
}

export async function unlockSharedTaggedCasesSession(
  kind: TaggedCaseKind,
  claveHash: string,
): Promise<void> {
  const response = await fetch(LIST_ENDPOINTS[kind], {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accion: 'desbloquear-sesion',
      clave: claveHash,
    }),
  })

  if (!response.ok) {
    throw await parseTaggedError(
      response,
      'No fue posible desbloquear este equipo',
    )
  }
}

export async function releaseSharedTaggedCasesSession(
  kind: TaggedCaseKind,
): Promise<void> {
  const response = await fetch(LIST_ENDPOINTS[kind], {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accion: 'cerrar-sesion-edicion' }),
  })

  if (!response.ok) {
    throw await parseTaggedError(
      response,
      'No fue posible cerrar el desbloqueo de este equipo',
    )
  }
}

export { POLL_INTERVAL_MS as TAGGED_CASES_POLL_MS }

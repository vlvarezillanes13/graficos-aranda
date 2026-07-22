import { getAuthHeaders } from './authService'

export interface SharedUrgentState {
  urgentIds: string[]
  actualizadoPor: string | null
  actualizadoEn: string | null
  version: number
}

const POLL_INTERVAL_MS = 5000

export async function fetchSharedUrgentState(): Promise<SharedUrgentState> {
  const response = await fetch('/api/urgent-cases', {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(
      typeof detail.error === 'string'
        ? detail.error
        : `Error al cargar urgentes (${response.status})`,
    )
  }

  return (await response.json()) as SharedUrgentState
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

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'No fue posible actualizar la lista de urgentes',
    )
  }

  return data as SharedUrgentState
}

export { POLL_INTERVAL_MS as URGENT_CASES_POLL_MS }

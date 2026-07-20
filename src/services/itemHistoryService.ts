import type { IncidentItem } from '../types/incident'
import type { HistoryEntry, ItemHistoryResponse } from '../types/itemHistory'
import { getAuthHeaders } from './authService'

export async function fetchItemHistory(
  item: IncidentItem,
): Promise<HistoryEntry[]> {
  const params = new URLSearchParams({
    itemId: String(item.id),
    isClosed: String(item.isClosed),
    modelId: String(item.modelId),
    statusId: String(item.stateId),
  })

  const response = await fetch(`/api/itsm-item-history?${params}`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(
      typeof detail.error === 'string'
        ? detail.error
        : `Error al cargar historial (${response.status})`,
    )
  }

  const data = (await response.json()) as ItemHistoryResponse
  return data.content ?? []
}

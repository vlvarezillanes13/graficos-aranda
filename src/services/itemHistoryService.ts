import type { IncidentItem } from '../types/incident'
import type { HistoryEntry, ItemHistoryResponse } from '../types/itemHistory'
import { ensureItsmApiOk, fetchItsmApi } from './itsmApiClient'

export async function fetchItemHistory(
  item: IncidentItem,
): Promise<HistoryEntry[]> {
  const params = new URLSearchParams({
    itemId: String(item.id),
    isClosed: String(item.isClosed),
    modelId: String(item.modelId),
    statusId: String(item.stateId),
  })

  const response = await ensureItsmApiOk(
    await fetchItsmApi(`/api/itsm-item-history?${params}`),
  )

  const data = (await response.json()) as ItemHistoryResponse
  return data.content ?? []
}

import type { IncidentItem } from '../types/incident'
import type { HistoryEntry, ItemHistoryResponse } from '../types/itemHistory'
import { normalizeHistoryEntry } from '../utils/itemHistory'
import { ensureItsmApiOk, fetchItsmApi } from './itsmApiClient'

const HISTORY_PAGE_SIZE = 100

async function fetchItemHistoryPage(
  item: IncidentItem,
  pageIndex: number,
): Promise<ItemHistoryResponse> {
  const params = new URLSearchParams({
    itemId: String(item.id),
    isClosed: String(item.isClosed),
    modelId: String(item.modelId),
    statusId: String(item.stateId),
    pageIndex: String(pageIndex),
    pageSize: String(HISTORY_PAGE_SIZE),
  })

  const response = await ensureItsmApiOk(
    await fetchItsmApi(`/api/itsm-item-history?${params}`),
  )

  return (await response.json()) as ItemHistoryResponse
}

export async function fetchItemHistory(
  item: IncidentItem,
): Promise<HistoryEntry[]> {
  const allEntries: HistoryEntry[] = []
  let pageIndex = 0
  let totalItems = Number.POSITIVE_INFINITY

  while (allEntries.length < totalItems) {
    const data = await fetchItemHistoryPage(item, pageIndex)
    const batch = (data.content ?? []).map(normalizeHistoryEntry)

    if (batch.length === 0) break

    totalItems = data.totalItems ?? batch.length
    allEntries.push(...batch)

    if (batch.length < HISTORY_PAGE_SIZE) break
    pageIndex += 1
  }

  return allEntries
}

import { ensureItsmApiOk, fetchItsmApi } from './itsmApiClient'

export interface ItemDescriptionPayload {
  description: string
  descriptionNoHtml: string
}

function unwrapDescription(payload: unknown): ItemDescriptionPayload {
  if (!payload || typeof payload !== 'object') {
    return { description: '', descriptionNoHtml: '' }
  }

  const record = payload as Record<string, unknown>
  const source =
    record.content && typeof record.content === 'object' && !Array.isArray(record.content)
      ? (record.content as Record<string, unknown>)
      : record

  return {
    description: typeof source.description === 'string' ? source.description : '',
    descriptionNoHtml:
      typeof source.descriptionNoHtml === 'string' ? source.descriptionNoHtml : '',
  }
}

export async function fetchItemDescription(
  itemId: number,
): Promise<ItemDescriptionPayload> {
  const params = new URLSearchParams({ itemId: String(itemId) })
  const response = await ensureItsmApiOk(
    await fetchItsmApi(`/api/itsm-item?${params}`),
  )
  return unwrapDescription(await response.json())
}

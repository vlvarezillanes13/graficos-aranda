import type {
  AdditionalField,
  ItemDeliveryDates,
} from '../types/additionalField'
import type { IncidentItem } from '../types/incident'
import { ensureItsmApiOk, fetchItsmApi } from './itsmApiClient'

const DELIVERY_FIELD_NAMES = new Set(['fecha de entrega'])
const DELIVERY_TEST_FIELD_NAMES = new Set(['fecha entrega test'])
const ULTIMA_ITERACION_FIELD_NAMES = new Set([
  'fecha ultima iteración',
  'fecha ultima iteracion',
])
const TEST_APROBADO_FIELD_NAMES = new Set(['fecha test aprobado'])
const FETCH_CONCURRENCY = 6

const cache = new Map<number, ItemDeliveryDates>()
const inflight = new Map<number, Promise<ItemDeliveryDates>>()

function parseAdditionalFieldsResponse(payload: unknown): AdditionalField[] {
  if (Array.isArray(payload)) {
    return payload as AdditionalField[]
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { content?: unknown[] }).content)
  ) {
    return (payload as { content: AdditionalField[] }).content
  }

  return []
}

function normalizeFieldName(value: string): string {
  return value.trim().toLowerCase()
}

function parseDateValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value > 0 ? value : null

  const trimmed = value.trim()
  if (!trimmed) return null

  const numeric = Number(trimmed)
  if (!Number.isNaN(numeric) && numeric > 0) return numeric

  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

export function extractDeliveryDatesFromFields(
  fields: AdditionalField[],
): ItemDeliveryDates {
  let deliveryDate: number | null = null
  let deliveryTestDate: number | null = null
  let ultimaIteracion: number | null = null
  let testAprobado: number | null = null

  for (const field of fields) {
    const label = normalizeFieldName(field.name || field.identifier || '')
    const timestamp = parseDateValue(field.dateValue)
    if (!timestamp) continue

    if (DELIVERY_FIELD_NAMES.has(label)) {
      deliveryDate = timestamp
      continue
    }

    if (DELIVERY_TEST_FIELD_NAMES.has(label)) {
      deliveryTestDate = timestamp
      continue
    }

    if (ULTIMA_ITERACION_FIELD_NAMES.has(label)) {
      ultimaIteracion = timestamp
      continue
    }

    if (TEST_APROBADO_FIELD_NAMES.has(label)) {
      testAprobado = timestamp
    }
  }

  return { deliveryDate, deliveryTestDate, ultimaIteracion, testAprobado }
}

export function createEmptyDeliveryDates(): ItemDeliveryDates {
  return {
    deliveryDate: null,
    deliveryTestDate: null,
    ultimaIteracion: null,
    testAprobado: null,
  }
}

function buildAdditionalFieldsBody(item: IncidentItem) {
  return {
    asdkWeb: true,
    categoryId: item.categoryId,
    consoleType: 'specialist' as const,
    id: item.id,
    itemType: item.itemType,
    modelId: item.modelId,
    serviceId: item.serviceId,
    stateId: item.stateId,
  }
}

export function getCachedDeliveryDates(
  itemId: number,
): ItemDeliveryDates | undefined {
  return cache.get(itemId)
}

export function clearDeliveryDatesCache(): void {
  cache.clear()
  inflight.clear()
}

async function fetchItemDeliveryDatesUncached(
  item: IncidentItem,
): Promise<ItemDeliveryDates> {
  const response = await ensureItsmApiOk(
    await fetchItsmApi('/api/itsm-additionalfields', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildAdditionalFieldsBody(item)),
    }),
  )

  const payload = (await response.json()) as unknown
  const dates = extractDeliveryDatesFromFields(
    parseAdditionalFieldsResponse(payload),
  )
  cache.set(item.id, dates)
  return dates
}

export async function fetchItemDeliveryDates(
  item: IncidentItem,
): Promise<ItemDeliveryDates> {
  const cached = cache.get(item.id)
  if (cached) return cached

  const pending = inflight.get(item.id)
  if (pending) return pending

  const request = fetchItemDeliveryDatesUncached(item).finally(() => {
    inflight.delete(item.id)
  })

  inflight.set(item.id, request)
  return request
}

async function fetchWithConcurrency(
  items: IncidentItem[],
  concurrency: number,
): Promise<Map<number, ItemDeliveryDates>> {
  const result = new Map<number, ItemDeliveryDates>()
  const queue = items.filter(
    (item) => !cache.has(item.id) && !inflight.has(item.id),
  )

  if (queue.length === 0) {
    for (const item of items) {
      const cached = cache.get(item.id)
      if (cached) result.set(item.id, cached)
    }
    return result
  }

  let index = 0

  const worker = async () => {
    while (index < queue.length) {
      const current = queue[index]
      index += 1

    try {
        const dates = await fetchItemDeliveryDates(current)
        result.set(current.id, dates)
      } catch {
        const emptyDates = createEmptyDeliveryDates()
        cache.set(current.id, emptyDates)
        result.set(current.id, emptyDates)
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    () => worker(),
  )
  await Promise.all(workers)

  for (const item of items) {
    const cached = cache.get(item.id)
    if (cached) result.set(item.id, cached)
  }

  return result
}

export async function fetchDeliveryDatesForItems(
  items: IncidentItem[],
): Promise<Map<number, ItemDeliveryDates>> {
  const uniqueItems = Array.from(
    new Map(items.map((item) => [item.id, item])).values(),
  )

  return fetchWithConcurrency(uniqueItems, FETCH_CONCURRENCY)
}

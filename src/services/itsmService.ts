import {
  CLOSED_SEARCH_BODY,
  DEFAULT_SEARCH_BODY,
  PAGE_SIZE,
  getItsmApiUrl,
} from '../config/itsm'
import { getAuthHeaders } from './authService'
import type { IncidentItem } from '../types/incident'
import type { FetchResult, ItsmSearchRequest, ItsmSearchResponse } from '../types/itsm'

function buildHeaders(): HeadersInit {
  return {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  }
}



function toFetchError(error: unknown): Error {

  if (error instanceof Error) {

    const apiUrl = getItsmApiUrl()



    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {

      return new Error(
        `No se pudo conectar al API ITSM (${apiUrl}). ` +
          'En local usa npm run dev. En Vercel configura ITSM_AUTH_TOKEN.',
      )

    }



    return error

  }



  return new Error('Error desconocido al consultar ITSM')

}



async function searchPage(

  body: ItsmSearchRequest,

): Promise<ItsmSearchResponse> {

  const apiUrl = getItsmApiUrl()



  let response: Response



  try {

    response = await fetch(apiUrl, {

      method: 'POST',

      headers: buildHeaders(),

      body: JSON.stringify(body),

    })

  } catch (error) {

    throw toFetchError(error)

  }



  if (!response.ok) {

    const detail = await response.text().catch(() => '')

    throw new Error(

      `Error ITSM ${response.status} en ${apiUrl}: ${response.statusText}${detail ? ` — ${detail.slice(0, 120)}` : ''}`,

    )

  }



  return (await response.json()) as ItsmSearchResponse

}



async function fetchAllPages(

  baseBody: Omit<ItsmSearchRequest, 'pageIndex' | 'pageSize'>,

): Promise<{ items: IncidentItem[]; totalItems: number }> {

  const allItems: IncidentItem[] = []

  let totalItems = 0

  let pageIndex = 0



  while (true) {

    const response = await searchPage({

      ...baseBody,

      pageIndex,

      pageSize: PAGE_SIZE,

    })



    allItems.push(...response.content)

    totalItems = response.totalItems



    const hasMore =

      response.content.length > 0 && allItems.length < totalItems



    if (!hasMore) break

    pageIndex += 1

  }



  return { items: allItems, totalItems }

}



function mergeItems(

  openItems: IncidentItem[],

  closedItems: IncidentItem[],

): IncidentItem[] {

  const byId = new Map<number, IncidentItem>()



  for (const item of openItems) {

    byId.set(item.id, item)

  }



  for (const item of closedItems) {

    byId.set(item.id, { ...item, isClosed: true })

  }



  return Array.from(byId.values())

}



export async function fetchItsmItems(): Promise<FetchResult> {
  const [openResult, closedResult] = await Promise.all([

    fetchAllPages(DEFAULT_SEARCH_BODY),

    fetchAllPages(CLOSED_SEARCH_BODY),

  ])



  const items = mergeItems(openResult.items, closedResult.items)



  return {

    items,

    totalItems: openResult.totalItems + closedResult.totalItems,

    fetchedAt: new Date(),

  }

}



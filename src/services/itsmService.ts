import {
  DEFAULT_SEARCH_BODY,
  PAGE_SIZE,
  getItsmApiUrl,
  isItsmConfigured,
} from '../config/itsm'
import { mockIncidents } from '../data/mockIncidents'
import type { IncidentItem } from '../types/incident'
import type { FetchResult, ItsmSearchRequest, ItsmSearchResponse } from '../types/itsm'

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    Origin: 'https://itsm.sonda.com',
    Referer: 'https://itsm.sonda.com/asmsspecialist/index.html',
  }

  const token = import.meta.env.VITE_ITSM_AUTH_TOKEN
  if (token) {
    headers['x-authorization'] = token.startsWith('Bearer ')
      ? token
      : `Bearer ${token}`
  }

  const cookie = import.meta.env.VITE_ITSM_AUTH_COOKIE
  if (cookie) {
    headers.Cookie = cookie
  }

  return headers
}

async function searchPage(
  body: ItsmSearchRequest,
): Promise<ItsmSearchResponse> {
  const response = await fetch(getItsmApiUrl(), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Error ITSM ${response.status}: ${response.statusText}${detail ? ` — ${detail.slice(0, 120)}` : ''}`,
    )
  }

  return (await response.json()) as ItsmSearchResponse
}

export async function fetchItsmItems(): Promise<FetchResult> {
  if (!isItsmConfigured()) {
    await delay(350)
    return {
      items: mockIncidents,
      totalItems: mockIncidents.length,
      source: 'mock',
      fetchedAt: new Date(),
    }
  }

  const allItems: IncidentItem[] = []
  let totalItems = 0
  let pageIndex = 0

  while (true) {
    const response = await searchPage({
      ...DEFAULT_SEARCH_BODY,
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

  return {
    items: allItems,
    totalItems,
    source: 'itsm',
    fetchedAt: new Date(),
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

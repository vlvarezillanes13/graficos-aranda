import { buildItsmHeaders } from './itsmApi.js'
import {
  clearItsmSessionTokenCache,
  refreshItsmSessionToken,
} from './itsmSessionToken.js'

function resolveContentType(init: RequestInit): string {
  if (init.method === 'GET' || init.method === 'HEAD') {
    return ''
  }

  return 'application/json'
}

export async function itsmFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const contentType = resolveContentType(init)
  let headers = {
    ...(await buildItsmHeaders(contentType)),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  }

  let response = await fetch(url, {
    ...init,
    headers,
  })

  if (response.status !== 401) {
    return response
  }

  clearItsmSessionTokenCache()
  await refreshItsmSessionToken()
  headers = {
    ...(await buildItsmHeaders(contentType, true)),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  }

  return fetch(url, {
    ...init,
    headers,
  })
}

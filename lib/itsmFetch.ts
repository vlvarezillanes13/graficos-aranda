import { buildItsmHeaders } from './itsmApi.js'
import { clearItsmSharedCredentials } from './itsmSharedCredentials.js'

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
  const headers = {
    ...buildItsmHeaders(contentType),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  }

  const response = await fetch(url, {
    ...init,
    headers,
  })

  if (response.status === 401) {
    clearItsmSharedCredentials()
  }

  return response
}

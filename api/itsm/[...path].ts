import type { VercelRequest, VercelResponse } from '@vercel/node'

const ITSM_ORIGIN = 'https://itsm.sonda.com'

function getAuthToken(): string | undefined {
  return process.env.ITSM_AUTH_TOKEN ?? process.env.VITE_ITSM_AUTH_TOKEN
}

function getAuthCookie(): string | undefined {
  const raw = process.env.ITSM_AUTH_COOKIE ?? process.env.VITE_ITSM_AUTH_COOKIE
  if (!raw) return undefined
  return raw.split(';')[0]?.trim()
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const pathSegments = request.query.path
  const path = Array.isArray(pathSegments)
    ? pathSegments.join('/')
    : (pathSegments ?? '')

  const search = request.url?.includes('?')
    ? request.url.slice(request.url.indexOf('?'))
    : ''

  const token = getAuthToken()
  if (!token) {
    return response.status(500).json({
      error:
        'Configura ITSM_AUTH_TOKEN en las variables de entorno de Vercel.',
    })
  }

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    Origin: ITSM_ORIGIN,
    Referer: `${ITSM_ORIGIN}/asmsspecialist/index.html`,
    'x-authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  }

  const cookie = getAuthCookie()
  if (cookie) {
    headers.Cookie = cookie
  }

  const targetUrl = `${ITSM_ORIGIN}/${path}${search}`

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body:
        request.method === 'POST'
          ? JSON.stringify(request.body ?? {})
          : undefined,
    })

    const body = await upstream.text()

    response.status(upstream.status)
    response.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json',
    )
    return response.send(body)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    return response.status(502).json({ error: message })
  }
}

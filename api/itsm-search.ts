import {
  extractBearerToken,
  verifySessionToken,
} from '../lib/auth.js'
import {
  getItsmAuthCookie,
  getItsmAuthToken,
  ITSM_AUTH_TOKEN_ERROR,
} from '../lib/env.js'

const ITSM_ORIGIN = 'https://itsm.sonda.com'
const ITSM_SEARCH_URL = `${ITSM_ORIGIN}/asmsconsole/api/v9/item/search?language=0`

export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    return Response.json({
      ok: true,
      tokenConfigured: Boolean(getItsmAuthToken()),
      cookieConfigured: Boolean(getItsmAuthCookie()),
    })
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const sessionToken = extractBearerToken(request.headers.get('Authorization'))
  const user = await verifySessionToken(sessionToken)
  if (!user) {
    return Response.json({ error: 'Sesión no válida o expirada' }, { status: 401 })
  }

  const token = getItsmAuthToken()
  if (!token) {
    return Response.json({ error: ITSM_AUTH_TOKEN_ERROR }, { status: 500 })
  }

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    Origin: ITSM_ORIGIN,
    Referer: `${ITSM_ORIGIN}/asmsspecialist/index.html`,
    'x-authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  }

  const cookie = getItsmAuthCookie()
  if (cookie) {
    headers.Cookie = cookie
  }

  try {
    const upstream = await fetch(ITSM_SEARCH_URL, {
      method: 'POST',
      headers,
      body: (await request.text()) || '{}',
    })

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    return Response.json({ error: message }, { status: 502 })
  }
}

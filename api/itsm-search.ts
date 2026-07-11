import {
  extractBearerToken,
  verifySessionToken,
} from '../lib/auth.js'

const ITSM_ORIGIN = 'https://itsm.sonda.com'
const ITSM_SEARCH_URL = `${ITSM_ORIGIN}/asmsconsole/api/v9/item/search?language=0`

export const config = {
  runtime: 'edge',
}

function getAuthToken(): string | undefined {
  return (process.env.ITSM_AUTH_TOKEN ?? process.env.VITE_ITSM_AUTH_TOKEN)?.trim()
}

function getAuthCookie(): string | undefined {
  const raw = process.env.ITSM_AUTH_COOKIE ?? process.env.VITE_ITSM_AUTH_COOKIE
  if (!raw) return undefined

  const cookie = raw.split(';')[0]?.trim()
  if (!cookie) return undefined

  return cookie.includes('=') ? cookie : `AuthCookieASMS=${cookie}`
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    return Response.json({
      ok: true,
      tokenConfigured: Boolean(getAuthToken()),
      cookieConfigured: Boolean(getAuthCookie()),
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

  const token = getAuthToken()
  if (!token) {
    return Response.json(
      {
        error:
          'Configura ITSM_AUTH_TOKEN en Vercel → Settings → Environment Variables y haz Redeploy.',
      },
      { status: 500 },
    )
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

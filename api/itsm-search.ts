import {
  extractBearerToken,
  verifySessionToken,
} from '../lib/auth.js'
import { buildItsmSearchUrl } from '../lib/itsmApi.js'
import {
  getItsmIntegrationToken,
  ITSM_BOOTSTRAP_ERROR,
} from '../lib/env.js'
import { getCachedItsmSessionToken } from '../lib/itsmSessionToken.js'
import { itsmFetch } from '../lib/itsmFetch.js'

export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    return Response.json({
      ok: true,
      bootstrapConfigured: Boolean(getItsmIntegrationToken()),
      sessionTokenCached: Boolean(getCachedItsmSessionToken()),
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

  if (!getItsmIntegrationToken()) {
    return Response.json({ error: ITSM_BOOTSTRAP_ERROR }, { status: 500 })
  }

  try {
    const upstream = await itsmFetch(buildItsmSearchUrl(), {
      method: 'POST',
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

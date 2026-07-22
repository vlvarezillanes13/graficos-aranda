import {
  extractBearerToken,
  verifySessionToken,
} from '../lib/auth.js'
import { buildItsmSearchUrl } from '../lib/itsmApi.js'
import {
  assertItsmCredentialsConfigured,
  ItsmCredentialsMissingError,
  itsmTokenMissingPayload,
  mapUpstreamItsmResponse,
} from '../lib/itsmCredentialsResponse.js'
import { itsmFetch } from '../lib/itsmFetch.js'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const sessionToken = extractBearerToken(request.headers.get('Authorization'))
  const user = await verifySessionToken(sessionToken)
  if (!user) {
    return Response.json({ error: 'Sesión no válida o expirada' }, { status: 401 })
  }

  const credentials = await assertItsmCredentialsConfigured()
  if (!credentials.ok) {
    return Response.json(credentials.payload, { status: 401 })
  }

  try {
    const upstream = await itsmFetch(buildItsmSearchUrl(), {
      method: 'POST',
      body: (await request.text()) || '{}',
    })

    const body = await upstream.text()
    const mapped = await mapUpstreamItsmResponse(upstream.status, body)
    if (mapped.handled) {
      return Response.json(mapped.payload, { status: mapped.status })
    }

    return new Response(body, {
      status: mapped.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (error) {
    if (error instanceof ItsmCredentialsMissingError) {
      return Response.json(itsmTokenMissingPayload(), { status: 401 })
    }

    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    return Response.json({ error: message }, { status: 502 })
  }
}

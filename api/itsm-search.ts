import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ITSM_SEARCH_URL, buildItsmHeaders } from '../_lib/itsmProxy'

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const headers = buildItsmHeaders()
    const upstream = await fetch(ITSM_SEARCH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(request.body ?? {}),
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

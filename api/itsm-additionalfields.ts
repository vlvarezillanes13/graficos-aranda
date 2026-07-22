import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildAdditionalFieldsUrl,
  requireSessionFromAuthHeader,
} from '../lib/itsmApi.js'
import { itsmFetch } from '../lib/itsmFetch.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await requireSessionFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida o expirada' })
    return
  }

  try {
    const upstream = await itsmFetch(buildAdditionalFieldsUrl(), {
      method: 'POST',
      body: JSON.stringify(req.body ?? {}),
    })

    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json',
    )
    res.end(body)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    res.status(502).json({ error: message })
  }
}

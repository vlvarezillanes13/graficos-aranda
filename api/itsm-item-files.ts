import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildItemFilesUrl,
  requireSessionFromAuthHeader,
} from '../lib/itsmApi.js'
import { itsmFetch } from '../lib/itsmFetch.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await requireSessionFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida o expirada' })
    return
  }

  const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined
  const itemType =
    typeof req.query.itemType === 'string' ? req.query.itemType : '1'

  if (!itemId) {
    res.status(400).json({ error: 'itemId es obligatorio' })
    return
  }

  try {
    const upstream = await itsmFetch(buildItemFilesUrl(itemId, itemType), {
      method: 'GET',
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

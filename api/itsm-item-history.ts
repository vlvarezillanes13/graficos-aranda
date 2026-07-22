import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildItemHistoryUrl,
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
  const isClosed = req.query.isClosed === 'true'
  const modelId =
    typeof req.query.modelId === 'string' ? Number(req.query.modelId) : NaN
  const statusId =
    typeof req.query.statusId === 'string' ? Number(req.query.statusId) : NaN

  if (!itemId || Number.isNaN(modelId) || Number.isNaN(statusId)) {
    res.status(400).json({
      error: 'itemId, modelId y statusId son obligatorios',
    })
    return
  }

  try {
    const upstream = await itsmFetch(
      buildItemHistoryUrl(itemId, { isClosed, modelId, statusId }),
      { method: 'GET' },
    )

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

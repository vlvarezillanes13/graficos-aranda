import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildItemHistoryUrl,
  requireSessionFromAuthHeader,
} from '../lib/itsmApi.js'
import { itsmFetch } from '../lib/itsmFetch.js'
import {
  finishItsmTextProxy,
  guardItsmCredentials,
  handleItsmProxyError,
} from '../lib/itsmVercelProxy.js'

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

  if (!(await guardItsmCredentials(res))) return

  const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined
  const isClosed = req.query.isClosed === 'true'
  const modelId =
    typeof req.query.modelId === 'string' ? Number(req.query.modelId) : NaN
  const statusId =
    typeof req.query.statusId === 'string' ? Number(req.query.statusId) : NaN
  const pageIndex =
    typeof req.query.pageIndex === 'string'
      ? Number(req.query.pageIndex)
      : undefined
  const pageSize =
    typeof req.query.pageSize === 'string'
      ? Number(req.query.pageSize)
      : undefined

  if (!itemId || Number.isNaN(modelId) || Number.isNaN(statusId)) {
    res.status(400).json({
      error: 'itemId, modelId y statusId son obligatorios',
    })
    return
  }

  try {
    const upstream = await itsmFetch(
      buildItemHistoryUrl(itemId, {
        isClosed,
        modelId,
        statusId,
        pageIndex: pageIndex !== undefined && !Number.isNaN(pageIndex)
          ? pageIndex
          : undefined,
        pageSize: pageSize !== undefined && !Number.isNaN(pageSize)
          ? pageSize
          : undefined,
      }),
      { method: 'GET' },
    )
    await finishItsmTextProxy(res, upstream)
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

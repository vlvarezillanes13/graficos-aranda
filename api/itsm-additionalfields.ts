import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildAdditionalFieldsUrl,
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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await requireSessionFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida o expirada' })
    return
  }

  if (!guardItsmCredentials(res)) return

  try {
    const upstream = await itsmFetch(buildAdditionalFieldsUrl(), {
      method: 'POST',
      body: JSON.stringify(req.body ?? {}),
    })
    await finishItsmTextProxy(res, upstream)
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

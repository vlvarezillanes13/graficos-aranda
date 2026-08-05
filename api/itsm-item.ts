import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchItsmItem } from '../lib/assignResponsible.js'
import { requireSessionFromAuthHeader } from '../lib/itsmApi.js'
import {
  guardItsmCredentials,
  handleItsmProxyError,
} from '../lib/itsmVercelProxy.js'

function pickString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

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
  if (!itemId) {
    res.status(400).json({ error: 'itemId es obligatorio' })
    return
  }

  try {
    const item = await fetchItsmItem(itemId)
    res.status(200).json({
      description: pickString(item.description),
      descriptionNoHtml: pickString(item.descriptionNoHtml),
    })
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

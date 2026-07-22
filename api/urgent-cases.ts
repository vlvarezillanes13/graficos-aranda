import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSessionFromAuthHeader } from '../lib/itsmApi.js'
import {
  getUrgentCasesState,
  updateUrgentCasesState,
} from '../lib/urgentCasesStore.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida o expirada', source: 'app' })
    return
  }

  if (req.method === 'GET') {
    res.status(200).json(await getUrgentCasesState())
    return
  }

  if (req.method === 'POST') {
    try {
      const urgentIds = Array.isArray(req.body?.urgentIds) ? req.body.urgentIds : []
      const usuario =
        typeof req.body?.usuario === 'string' ? req.body.usuario : user.username

      res.status(200).json(await updateUrgentCasesState(urgentIds, usuario))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo actualizar urgentes'
      res.status(400).json({ error: message })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

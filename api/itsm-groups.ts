import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchItsmGroups } from '../lib/assignResponsible.js'
import { requireAdminSessionFromAuthHeader } from '../lib/itsmApi.js'
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

  const session = await requireAdminSessionFromAuthHeader(req.headers.authorization)
  if (!session) {
    res.status(403).json({
      error: 'Se requiere acceso administrador para consultar grupos de asignación',
    })
    return
  }

  if (!guardItsmCredentials(res)) return

  const serviceId =
    typeof req.query.serviceId === 'string'
      ? Number(req.query.serviceId)
      : NaN
  const stateId =
    typeof req.query.stateId === 'string' ? Number(req.query.stateId) : NaN

  if (Number.isNaN(serviceId) || Number.isNaN(stateId)) {
    res.status(400).json({ error: 'serviceId y stateId son obligatorios' })
    return
  }

  try {
    const upstream = await fetchItsmGroups(serviceId, stateId)
    await finishItsmTextProxy(res, upstream)
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

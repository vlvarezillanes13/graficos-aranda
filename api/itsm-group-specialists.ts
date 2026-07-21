import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchItsmGroupSpecialists } from '../lib/assignResponsible.js'
import { requireAdminSessionFromAuthHeader } from '../lib/itsmApi.js'

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
      error: 'Se requiere acceso administrador para consultar responsables',
    })
    return
  }

  const groupId =
    typeof req.query.groupId === 'string' ? Number(req.query.groupId) : NaN
  const projectId =
    typeof req.query.projectId === 'string'
      ? Number(req.query.projectId)
      : NaN

  if (Number.isNaN(groupId) || Number.isNaN(projectId)) {
    res.status(400).json({ error: 'groupId y projectId son obligatorios' })
    return
  }

  try {
    const upstream = await fetchItsmGroupSpecialists(groupId, projectId)
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

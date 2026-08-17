import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  isAzureDevOpsConfigured,
  searchAzureDevOpsBranches,
} from '../lib/azureDevOps.js'
import { requireAdminSessionFromAuthHeader } from '../lib/itsmApi.js'

export const config = {
  maxDuration: 60,
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const session = await requireAdminSessionFromAuthHeader(
    req.headers.authorization,
  )
  if (!session) {
    res.status(403).json({
      error: 'Se requiere acceso administrador para buscar ramas',
    })
    return
  }

  if (!isAzureDevOpsConfigured()) {
    res.status(503).json({
      error:
        'Azure DevOps no está configurado. Define AZURE_DEVOPS_PAT en el servidor.',
    })
    return
  }

  const queryRaw =
    typeof req.query.q === 'string'
      ? req.query.q
      : typeof req.query.rama === 'string'
        ? req.query.rama
        : ''

  const query = queryRaw.trim()
  if (query.length < 2) {
    res.status(400).json({
      error: 'Indica al menos 2 caracteres para buscar la rama',
    })
    return
  }

  if (query.length > 120) {
    res.status(400).json({ error: 'La búsqueda es demasiado larga' })
    return
  }

  try {
    const result = await searchAzureDevOpsBranches(query)
    res.status(200).json(result)
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : 'No se pudo consultar Azure DevOps',
    })
  }
}

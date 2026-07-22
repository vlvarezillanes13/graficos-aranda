import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getItsmSharedCredentialsMeta,
  setItsmSharedCredentials,
} from '../lib/itsmSharedCredentials.js'
import { requireSessionFromAuthHeader } from '../lib/itsmApi.js'

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
    res.status(200).json(await getItsmSharedCredentialsMeta())
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    const cookie =
      typeof req.body?.cookie === 'string' ? req.body.cookie : undefined

    if (!token) {
      res.status(400).json({ error: 'token es obligatorio' })
      return
    }

    await setItsmSharedCredentials(token, cookie, user.username)
    res.status(200).json(await getItsmSharedCredentialsMeta())
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo guardar el token ITSM'
    res.status(400).json({ error: message })
  }
}

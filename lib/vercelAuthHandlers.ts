import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  createSessionToken,
  extractBearerToken,
  verifyCredentials,
  verifySessionToken,
  type LoginRequest,
} from './auth.js'

export async function handleVercelAuthLogin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const body = (req.body ?? {}) as LoginRequest
    const username = body.username?.trim() ?? ''
    const passwordHash = body.passwordHash?.trim() ?? ''

    if (!username || !passwordHash) {
      res.status(400).json({ error: 'Usuario y contraseña son obligatorios' })
      return
    }

    const role = await verifyCredentials(username, passwordHash)
    if (!role) {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
      return
    }

    const session = await createSessionToken(
      username.toUpperCase(),
      role === 'admin',
    )
    res.status(200).json(session)
  } catch {
    res.status(400).json({ error: 'Solicitud inválida' })
  }
}

export async function handleVercelAuthVerify(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = extractBearerToken(req.headers.authorization)
  const session = await verifySessionToken(token)

  if (!session) {
    res.status(401).json({ valid: false })
    return
  }

  res.status(200).json({
    valid: true,
    username: session.username,
    isAdmin: session.isAdmin,
  })
}

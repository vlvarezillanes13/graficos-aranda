import {
  createSessionToken,
  verifyCredentials,
  type LoginRequest,
} from '../../lib/auth.js'

export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const body = (await request.json()) as LoginRequest
    const username = body.username?.trim() ?? ''
    const passwordHash = body.passwordHash?.trim() ?? ''

    if (!username || !passwordHash) {
      return Response.json(
        { error: 'Usuario y contraseña son obligatorios' },
        { status: 400 },
      )
    }

    const isValid = await verifyCredentials(username, passwordHash)
    if (!isValid) {
      return Response.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 },
      )
    }

    const session = await createSessionToken(username.toUpperCase())
    return Response.json(session)
  } catch {
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
}

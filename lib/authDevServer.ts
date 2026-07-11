import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  createSessionToken,
  extractBearerToken,
  verifyCredentials,
  verifySessionToken,
  type LoginRequest,
} from './auth'

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk: Buffer | string) => {
      body += chunk.toString()
    })

    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })

    request.on('error', reject)
  })
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

export async function handleAuthLogin(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const body = (await readJsonBody(request)) as LoginRequest
    const username = body.username?.trim() ?? ''
    const passwordHash = body.passwordHash?.trim() ?? ''

    if (!username || !passwordHash) {
      sendJson(response, 400, {
        error: 'Usuario y contraseña son obligatorios',
      })
      return
    }

    const isValid = await verifyCredentials(username, passwordHash)
    if (!isValid) {
      sendJson(response, 401, { error: 'Usuario o contraseña incorrectos' })
      return
    }

    const session = await createSessionToken(username.toUpperCase())
    sendJson(response, 200, session)
  } catch {
    sendJson(response, 400, { error: 'Solicitud inválida' })
  }
}

export async function handleAuthVerify(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization)
  const username = await verifySessionToken(token)

  if (!username) {
    sendJson(response, 401, { valid: false })
    return
  }

  sendJson(response, 200, { valid: true, username })
}

export async function handleItsmAuthGuard(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<boolean> {
  const token = extractBearerToken(request.headers.authorization)
  const username = await verifySessionToken(token)

  if (!username) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada' })
    return false
  }

  return true
}

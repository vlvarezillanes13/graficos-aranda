import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getItsmSharedCredentialsMeta,
  setItsmSharedCredentials,
} from './itsmSharedCredentials.js'
import { requireSessionFromAuthHeader } from './itsmApi.js'

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? (JSON.parse(raw) as T) : ({} as T)
}

interface CredentialsBody {
  token?: string
  cookie?: string
}

export async function handleItsmCredentialsGet(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(request.headers.authorization)
  if (!user) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada', source: 'app' })
    return
  }

  sendJson(response, 200, getItsmSharedCredentialsMeta())
}

export async function handleItsmCredentialsPost(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(request.headers.authorization)
  if (!user) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada', source: 'app' })
    return
  }

  try {
    const body = await readJsonBody<CredentialsBody>(request)
    const token = body.token?.trim() ?? ''

    if (!token) {
      sendJson(response, 400, { error: 'token es obligatorio' })
      return
    }

    setItsmSharedCredentials(token, body.cookie, user.username)
    sendJson(response, 200, getItsmSharedCredentialsMeta())
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo guardar el token ITSM'
    sendJson(response, 400, { error: message })
  }
}

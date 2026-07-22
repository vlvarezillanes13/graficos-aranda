import type { IncomingMessage, ServerResponse } from 'node:http'
import { requireSessionFromAuthHeader } from './itsmApi.js'
import {
  getUrgentCasesState,
  updateUrgentCasesState,
} from './urgentCasesStore.js'

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

interface UrgentCasesBody {
  urgentIds?: string[]
  usuario?: string
}

export async function handleUrgentCasesGet(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(request.headers.authorization)
  if (!user) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada', source: 'app' })
    return
  }

  sendJson(response, 200, await getUrgentCasesState())
}

export async function handleUrgentCasesPost(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(request.headers.authorization)
  if (!user) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada', source: 'app' })
    return
  }

  try {
    const body = await readJsonBody<UrgentCasesBody>(request)
    const state = await updateUrgentCasesState(
      body.urgentIds ?? [],
      body.usuario ?? user.username,
    )
    sendJson(response, 200, state)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo actualizar urgentes'
    sendJson(response, 400, { error: message })
  }
}

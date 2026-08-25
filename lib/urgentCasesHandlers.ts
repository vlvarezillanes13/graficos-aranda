import type { IncomingMessage, ServerResponse } from 'node:http'
import { requireSessionFromAuthHeader } from './itsmApi.js'
import {
  getUrgentCasesState,
  setUrgentCasesEditLock,
  updateUrgentCasesState,
  UrgentCasesEditLockedError,
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
  edicionBloqueada?: boolean
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

    if (typeof body.edicionBloqueada === 'boolean') {
      if (!user.isAdmin) {
        sendJson(response, 403, {
          error:
            'Solo un administrador puede bloquear o desbloquear la actualización',
        })
        return
      }

      sendJson(
        response,
        200,
        await setUrgentCasesEditLock(
          body.edicionBloqueada,
          body.usuario ?? user.username,
        ),
      )
      return
    }

    const state = await updateUrgentCasesState(
      body.urgentIds ?? [],
      body.usuario ?? user.username,
    )
    sendJson(response, 200, state)
  } catch (error) {
    if (error instanceof UrgentCasesEditLockedError) {
      sendJson(response, 403, { error: error.message })
      return
    }

    const message =
      error instanceof Error ? error.message : 'No se pudo actualizar urgentes'
    sendJson(response, 400, { error: message })
  }
}

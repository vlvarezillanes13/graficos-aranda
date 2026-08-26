import type { IncomingMessage, ServerResponse } from 'node:http'
import { extractBearerToken } from './auth.js'
import { requireSessionFromAuthHeader } from './itsmApi.js'
import {
  hasUrgentCasesUnlockKey,
  revokeUrgentCasesSessionGrant,
  setUrgentCasesUnlockKey,
  unlockUrgentCasesSession,
  UrgentCasesKeyError,
} from './urgentCasesGrants.js'
import {
  getUrgentCasesState,
  setUrgentCasesEditLock,
  updateUrgentCasesState,
  UrgentCasesEditLockedError,
  UrgentCasesSessionLockedError,
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
  accion?: string
  clave?: string
}

function lockStatus(error: unknown): number | null {
  if (
    error instanceof UrgentCasesEditLockedError ||
    error instanceof UrgentCasesSessionLockedError ||
    error instanceof UrgentCasesKeyError
  ) {
    return 403
  }
  return null
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

  sendJson(response, 200, {
    ...(await getUrgentCasesState()),
    claveConfigurada: await hasUrgentCasesUnlockKey(),
  })
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

  const sessionToken = extractBearerToken(request.headers.authorization)

  try {
    const body = await readJsonBody<UrgentCasesBody>(request)

    if (body.accion === 'definir-clave') {
      if (!user.isAdmin) {
        sendJson(response, 403, {
          error: 'Solo un administrador puede definir la clave de urgentes',
        })
        return
      }

      await setUrgentCasesUnlockKey(
        typeof body.clave === 'string' ? body.clave : '',
        body.usuario ?? user.username,
      )
      sendJson(response, 200, {
        ok: true,
        claveConfigurada: true,
      })
      return
    }

    if (body.accion === 'desbloquear-sesion') {
      const state = await getUrgentCasesState()
      if (state.edicionBloqueada) {
        sendJson(response, 403, {
          error:
            'Un administrador debe habilitar la actualización antes de usar la clave',
        })
        return
      }

      await unlockUrgentCasesSession(
        sessionToken,
        user.username,
        typeof body.clave === 'string' ? body.clave : '',
      )
      sendJson(response, 200, { ok: true, desbloqueadoEnEquipo: true })
      return
    }

    if (body.accion === 'cerrar-sesion-edicion') {
      await revokeUrgentCasesSessionGrant(sessionToken)
      sendJson(response, 200, { ok: true })
      return
    }

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
      sessionToken,
    )
    sendJson(response, 200, state)
  } catch (error) {
    const status = lockStatus(error)
    if (status !== null) {
      sendJson(response, status, {
        error: error instanceof Error ? error.message : 'No autorizado',
      })
      return
    }

    const message =
      error instanceof Error ? error.message : 'No se pudo actualizar urgentes'
    sendJson(response, 400, { error: message })
  }
}

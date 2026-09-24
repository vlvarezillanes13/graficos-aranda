import type { IncomingMessage, ServerResponse } from 'node:http'
import { extractBearerToken } from './auth.js'
import { requireSessionFromAuthHeader } from './itsmApi.js'
import { TAGGED_CASE_LISTS, type TaggedCaseKind } from './taggedCaseListConfig.js'
import {
  hasTaggedCasesUnlockKey,
  revokeTaggedCasesSessionGrant,
  setTaggedCasesUnlockKey,
  TaggedCasesKeyError,
  unlockTaggedCasesSession,
} from './taggedCaseListGrants.js'
import {
  getTaggedCasesState,
  setTaggedCasesEditLock,
  TaggedCasesEditLockedError,
  TaggedCasesSessionLockedError,
  toPublicTaggedCasesState,
  updateTaggedCasesState,
} from './taggedCaseListStore.js'

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

interface TaggedCasesBody {
  urgentIds?: string[]
  stabilizationIds?: string[]
  caseIds?: string[]
  usuario?: string
  edicionBloqueada?: boolean
  accion?: string
  clave?: string
}

function lockStatus(error: unknown): number | null {
  if (
    error instanceof TaggedCasesEditLockedError ||
    error instanceof TaggedCasesSessionLockedError ||
    error instanceof TaggedCasesKeyError
  ) {
    return 403
  }
  return null
}

function readCaseIds(kind: TaggedCaseKind, body: TaggedCasesBody): unknown {
  const idsField = TAGGED_CASE_LISTS[kind].idsField
  if (Array.isArray(body[idsField])) return body[idsField]
  if (Array.isArray(body.caseIds)) return body.caseIds
  return []
}

export async function handleTaggedCasesGet(
  kind: TaggedCaseKind,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(request.headers.authorization)
  if (!user) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada', source: 'app' })
    return
  }

  sendJson(response, 200, {
    ...toPublicTaggedCasesState(kind, await getTaggedCasesState(kind)),
    claveConfigurada: await hasTaggedCasesUnlockKey(kind),
  })
}

export async function handleTaggedCasesPost(
  kind: TaggedCaseKind,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(request.headers.authorization)
  if (!user) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada', source: 'app' })
    return
  }

  const sessionToken = extractBearerToken(request.headers.authorization)
  const config = TAGGED_CASE_LISTS[kind]

  try {
    const body = await readJsonBody<TaggedCasesBody>(request)

    if (body.accion === 'definir-clave') {
      if (!user.isAdmin) {
        sendJson(response, 403, {
          error: `Solo un administrador puede definir la clave de ${config.label}`,
        })
        return
      }

      await setTaggedCasesUnlockKey(
        kind,
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
      const state = await getTaggedCasesState(kind)
      if (state.edicionBloqueada) {
        sendJson(response, 403, {
          error:
            'Un administrador debe habilitar la actualización antes de usar la clave',
        })
        return
      }

      await unlockTaggedCasesSession(
        kind,
        sessionToken,
        user.username,
        typeof body.clave === 'string' ? body.clave : '',
      )
      sendJson(response, 200, { ok: true, desbloqueadoEnEquipo: true })
      return
    }

    if (body.accion === 'cerrar-sesion-edicion') {
      await revokeTaggedCasesSessionGrant(kind, sessionToken)
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
        toPublicTaggedCasesState(
          kind,
          await setTaggedCasesEditLock(
            kind,
            body.edicionBloqueada,
            body.usuario ?? user.username,
          ),
        ),
      )
      return
    }

    const state = await updateTaggedCasesState(
      kind,
      readCaseIds(kind, body),
      body.usuario ?? user.username,
      sessionToken,
    )
    sendJson(response, 200, toPublicTaggedCasesState(kind, state))
  } catch (error) {
    const status = lockStatus(error)
    if (status !== null) {
      sendJson(response, status, {
        error: error instanceof Error ? error.message : 'No autorizado',
      })
      return
    }

    const message =
      error instanceof Error
        ? error.message
        : `No se pudo actualizar ${config.label}`
    sendJson(response, 400, { error: message })
  }
}

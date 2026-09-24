import type { VercelRequest, VercelResponse } from '@vercel/node'
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

export async function handleVercelTaggedCases(
  kind: TaggedCaseKind,
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida o expirada', source: 'app' })
    return
  }

  const config = TAGGED_CASE_LISTS[kind]

  if (req.method === 'GET') {
    res.status(200).json({
      ...toPublicTaggedCasesState(kind, await getTaggedCasesState(kind)),
      claveConfigurada: await hasTaggedCasesUnlockKey(kind),
    })
    return
  }

  if (req.method === 'POST') {
    const sessionToken = extractBearerToken(req.headers.authorization)
    const usuario =
      typeof req.body?.usuario === 'string' ? req.body.usuario : user.username
    const accion = typeof req.body?.accion === 'string' ? req.body.accion : ''

    try {
      if (accion === 'definir-clave') {
        if (!user.isAdmin) {
          res.status(403).json({
            error: `Solo un administrador puede definir la clave de ${config.label}`,
          })
          return
        }

        await setTaggedCasesUnlockKey(
          kind,
          typeof req.body?.clave === 'string' ? req.body.clave : '',
          usuario,
        )
        res.status(200).json({ ok: true, claveConfigurada: true })
        return
      }

      if (accion === 'desbloquear-sesion') {
        const state = await getTaggedCasesState(kind)
        if (state.edicionBloqueada) {
          res.status(403).json({
            error:
              'Un administrador debe habilitar la actualización antes de usar la clave',
          })
          return
        }

        await unlockTaggedCasesSession(
          kind,
          sessionToken,
          user.username,
          typeof req.body?.clave === 'string' ? req.body.clave : '',
        )
        res.status(200).json({ ok: true, desbloqueadoEnEquipo: true })
        return
      }

      if (accion === 'cerrar-sesion-edicion') {
        await revokeTaggedCasesSessionGrant(kind, sessionToken)
        res.status(200).json({ ok: true })
        return
      }

      if (typeof req.body?.edicionBloqueada === 'boolean') {
        if (!user.isAdmin) {
          res.status(403).json({
            error:
              'Solo un administrador puede bloquear o desbloquear la actualización',
          })
          return
        }

        res.status(200).json(
          toPublicTaggedCasesState(
            kind,
            await setTaggedCasesEditLock(kind, req.body.edicionBloqueada, usuario),
          ),
        )
        return
      }

      const idsField = config.idsField
      const caseIds = Array.isArray(req.body?.[idsField])
        ? req.body[idsField]
        : Array.isArray(req.body?.caseIds)
          ? req.body.caseIds
          : []

      res.status(200).json(
        toPublicTaggedCasesState(
          kind,
          await updateTaggedCasesState(kind, caseIds, usuario, sessionToken),
        ),
      )
    } catch (error) {
      if (
        error instanceof TaggedCasesEditLockedError ||
        error instanceof TaggedCasesSessionLockedError ||
        error instanceof TaggedCasesKeyError
      ) {
        res.status(403).json({ error: error.message })
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : `No se pudo actualizar ${config.label}`
      res.status(400).json({ error: message })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

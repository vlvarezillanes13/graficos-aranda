import type { VercelRequest, VercelResponse } from '@vercel/node'
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

export async function handleVercelUrgentCases(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida o expirada', source: 'app' })
    return
  }

  if (req.method === 'GET') {
    res.status(200).json({
      ...(await getUrgentCasesState()),
      claveConfigurada: await hasUrgentCasesUnlockKey(),
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
            error: 'Solo un administrador puede definir la clave de urgentes',
          })
          return
        }

        await setUrgentCasesUnlockKey(
          typeof req.body?.clave === 'string' ? req.body.clave : '',
          usuario,
        )
        res.status(200).json({ ok: true, claveConfigurada: true })
        return
      }

      if (accion === 'desbloquear-sesion') {
        const state = await getUrgentCasesState()
        if (state.edicionBloqueada) {
          res.status(403).json({
            error:
              'Un administrador debe habilitar la actualización antes de usar la clave',
          })
          return
        }

        await unlockUrgentCasesSession(
          sessionToken,
          user.username,
          typeof req.body?.clave === 'string' ? req.body.clave : '',
        )
        res.status(200).json({ ok: true, desbloqueadoEnEquipo: true })
        return
      }

      if (accion === 'cerrar-sesion-edicion') {
        await revokeUrgentCasesSessionGrant(sessionToken)
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

        res
          .status(200)
          .json(await setUrgentCasesEditLock(req.body.edicionBloqueada, usuario))
        return
      }

      const urgentIds = Array.isArray(req.body?.urgentIds)
        ? req.body.urgentIds
        : []

      res
        .status(200)
        .json(await updateUrgentCasesState(urgentIds, usuario, sessionToken))
    } catch (error) {
      if (
        error instanceof UrgentCasesEditLockedError ||
        error instanceof UrgentCasesSessionLockedError ||
        error instanceof UrgentCasesKeyError
      ) {
        res.status(403).json({ error: error.message })
        return
      }

      const message =
        error instanceof Error ? error.message : 'No se pudo actualizar urgentes'
      res.status(400).json({ error: message })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

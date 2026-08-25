import {
  extractBearerToken,
  verifySessionToken,
} from '../session.js'
import {
  getUrgentCasesState,
  setUrgentCasesEditLock,
  updateUrgentCasesState,
  UrgentCasesEditLockedError,
} from '../urgentCasesStore.js'

const STORE_POLL_MS = 5000

function cloneSharedState(state) {
  return {
    urgentIds: [...state.urgentIds],
    actualizadoPor: state.actualizadoPor,
    actualizadoEn: state.actualizadoEn,
    version: state.version,
    edicionBloqueada: state.edicionBloqueada !== false,
  }
}

function sameState(a, b) {
  return (
    a.version === b.version &&
    a.edicionBloqueada === b.edicionBloqueada &&
    a.actualizadoPor === b.actualizadoPor &&
    a.actualizadoEn === b.actualizadoEn &&
    a.urgentIds.length === b.urgentIds.length &&
    a.urgentIds.every((id, index) => id === b.urgentIds[index])
  )
}

function getSocketToken(socket) {
  const authToken = socket.handshake.auth?.token
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim()
  }

  return extractBearerToken(socket.handshake.headers.authorization)
}

/**
 * @param {import('socket.io').Server} io
 */
export async function configureUrgentCasesSocket(io) {
  let sharedState = await getUrgentCasesState()

  io.use(async (socket, next) => {
    try {
      const session = await verifySessionToken(getSocketToken(socket))
      if (!session) {
        next(new Error('unauthorized'))
        return
      }

      socket.data.session = session
      next()
    } catch (error) {
      next(error instanceof Error ? error : new Error('unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`[realtime] Cliente conectado: ${socket.id}`)
    socket.emit('urgent:estado-inicial', cloneSharedState(sharedState))

    socket.on('urgent:actualizar', async (datos = {}, responder) => {
      try {
        const session = socket.data.session
        const usuario =
          String(datos.usuario ?? session?.username ?? 'Usuario').trim() ||
          'Usuario'

        if (typeof datos.edicionBloqueada === 'boolean') {
          if (!session?.isAdmin) {
            responder?.({
              ok: false,
              mensaje:
                'Solo un administrador puede bloquear o desbloquear la actualización',
            })
            return
          }

          sharedState = await setUrgentCasesEditLock(
            datos.edicionBloqueada === true,
            usuario,
          )
          io.emit('urgent:actualizado', cloneSharedState(sharedState))
          responder?.({
            ok: true,
            version: sharedState.version,
          })
          return
        }

        sharedState = await updateUrgentCasesState(
          datos.urgentIds ?? datos.ids,
          usuario,
        )
        io.emit('urgent:actualizado', cloneSharedState(sharedState))
        responder?.({
          ok: true,
          version: sharedState.version,
        })
      } catch (error) {
        if (error instanceof UrgentCasesEditLockedError) {
          sharedState = await getUrgentCasesState()
          responder?.({
            ok: false,
            mensaje: error.message,
          })
          return
        }

        responder?.({
          ok: false,
          mensaje:
            error instanceof Error ? error.message : 'Error al actualizar',
        })
      }
    })

    socket.on('urgent:solicitar-estado', async (responder) => {
      sharedState = await getUrgentCasesState()
      responder?.({
        ok: true,
        estado: cloneSharedState(sharedState),
      })
    })

    socket.on('disconnect', (motivo) => {
      console.log(`[realtime] Cliente desconectado: ${socket.id} (${motivo})`)
    })
  })

  const pollId = setInterval(() => {
    void getUrgentCasesState()
      .then((latest) => {
        if (sameState(latest, sharedState)) return
        sharedState = latest
        io.emit('urgent:actualizado', cloneSharedState(sharedState))
      })
      .catch((error) => {
        console.error('[realtime] No se pudo sincronizar urgentes:', error)
      })
  }, STORE_POLL_MS)

  pollId.unref?.()
}

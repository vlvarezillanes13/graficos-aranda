function normalizeUrgentIds(raw) {
  if (!Array.isArray(raw)) return []

  const seen = new Set()
  const normalized = []

  for (const value of raw) {
    const id = String(value ?? '')
      .trim()
      .toUpperCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }

  return normalized
}

function cloneSharedState(state) {
  return {
    urgentIds: [...state.urgentIds],
    actualizadoPor: state.actualizadoPor,
    actualizadoEn: state.actualizadoEn,
    version: state.version,
  }
}

let sharedState = {
  urgentIds: [],
  actualizadoPor: null,
  actualizadoEn: null,
  version: 0,
}

/**
 * @param {import('socket.io').Server} io
 */
export function configureUrgentCasesSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[realtime] Cliente conectado: ${socket.id}`)

    socket.emit('urgent:estado-inicial', cloneSharedState(sharedState))

    socket.on('urgent:actualizar', (datos = {}, responder) => {
      try {
        const urgentIds = normalizeUrgentIds(datos.urgentIds ?? datos.ids)
        const usuario = String(datos.usuario ?? 'Usuario').trim() || 'Usuario'

        sharedState = {
          urgentIds,
          actualizadoPor: usuario,
          actualizadoEn: new Date().toISOString(),
          version: sharedState.version + 1,
        }

        io.emit('urgent:actualizado', cloneSharedState(sharedState))

        responder?.({
          ok: true,
          version: sharedState.version,
        })
      } catch (error) {
        responder?.({
          ok: false,
          mensaje: error instanceof Error ? error.message : 'Error al actualizar',
        })
      }
    })

    socket.on('urgent:solicitar-estado', (responder) => {
      responder?.({
        ok: true,
        estado: cloneSharedState(sharedState),
      })
    })

    socket.on('disconnect', (motivo) => {
      console.log(`[realtime] Cliente desconectado: ${socket.id} (${motivo})`)
    })
  })
}

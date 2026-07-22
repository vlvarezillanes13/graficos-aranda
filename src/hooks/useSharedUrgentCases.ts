import { useCallback, useEffect, useState } from 'react'
import {
  getRealtimeSocket,
  realtimeEnabled,
  type SharedUrgentState,
} from '../services/socket'
import { readUrgentCaseIds, writeUrgentCaseIds } from '../utils/urgentCases'

const estadoInicial: SharedUrgentState = {
  urgentIds: [],
  actualizadoPor: null,
  actualizadoEn: null,
  version: 0,
}

function normalizeIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const value of ids) {
    const id = value.trim().toUpperCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }

  return normalized
}

function applySharedState(
  previous: SharedUrgentState,
  next: SharedUrgentState,
): SharedUrgentState {
  if (
    next.version !== undefined &&
    previous.version !== undefined &&
    next.version < previous.version
  ) {
    return previous
  }

  writeUrgentCaseIds(next.urgentIds)
  return next
}

export function useSharedUrgentCases(
  username: string | null,
  enabled: boolean,
) {
  const [state, setState] = useState<SharedUrgentState>(() => ({
    ...estadoInicial,
    urgentIds: enabled ? readUrgentCaseIds() : [],
  }))
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState('')

  useEffect(() => {
    if (!enabled) {
      setConnected(false)
      setConnectionError('')
      return
    }

    const socket = getRealtimeSocket()

    function setUrgentIdsFromLocal() {
      setState((current) => ({
        ...current,
        urgentIds: readUrgentCaseIds(),
      }))
    }

    if (!socket) {
      setUrgentIdsFromLocal()
      return
    }

    function handleConnect() {
      setConnected(true)
      setConnectionError('')
    }

    function handleDisconnect() {
      setConnected(false)
    }

    function handleConnectError(error: Error) {
      setConnected(false)
      setConnectionError(error.message || 'No fue posible conectar al servidor')
      setUrgentIdsFromLocal()
    }

    function handleSharedState(next: SharedUrgentState) {
      setState((previous) => applySharedState(previous, next))
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('urgent:estado-inicial', handleSharedState)
    socket.on('urgent:actualizado', handleSharedState)

    if (!socket.connected) {
      socket.connect()
    } else {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('urgent:estado-inicial', handleSharedState)
      socket.off('urgent:actualizado', handleSharedState)
      socket.disconnect()
    }
  }, [enabled])

  const updateUrgentIds = useCallback(
    (ids: string[]) => {
      const normalized = normalizeIds(ids)
      const socket = getRealtimeSocket()

      if (!realtimeEnabled || !socket?.connected) {
        writeUrgentCaseIds(normalized)
        setState((current) => ({
          ...current,
          urgentIds: normalized,
          actualizadoPor: username,
          actualizadoEn: new Date().toISOString(),
          version: current.version + 1,
        }))
        return Promise.resolve()
      }

      return new Promise<void>((resolve, reject) => {
        socket.timeout(15000).emit(
          'urgent:actualizar',
          {
            urgentIds: normalized,
            usuario: username ?? 'Usuario',
          },
          (errorTimeout, respuesta) => {
            if (errorTimeout) {
              reject(new Error('El servidor no respondió a tiempo'))
              return
            }

            if (!respuesta?.ok) {
              reject(
                new Error(
                  respuesta?.mensaje || 'No fue posible actualizar la lista',
                ),
              )
              return
            }

            resolve()
          },
        )
      })
    },
    [username],
  )

  return {
    urgentIds: state.urgentIds,
    updatedBy: state.actualizadoPor,
    updatedAt: state.actualizadoEn,
    connected,
    realtimeEnabled,
    connectionError,
    updateUrgentIds,
  }
}

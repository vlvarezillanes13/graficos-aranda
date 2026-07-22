import { useCallback, useEffect, useState } from 'react'
import {
  fetchSharedUrgentState,
  saveSharedUrgentState,
  URGENT_CASES_POLL_MS,
  type SharedUrgentState,
} from '../services/urgentCasesService'
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

    let cancelled = false

    async function refreshSharedState() {
      try {
        const next = await fetchSharedUrgentState()
        if (cancelled) return
        setState((previous) => applySharedState(previous, next))
        setConnected(true)
        setConnectionError('')
      } catch (error) {
        if (cancelled) return
        setConnected(false)
        setConnectionError(
          error instanceof Error
            ? error.message
            : 'No fue posible sincronizar urgentes',
        )
        setState((current) => ({
          ...current,
          urgentIds: readUrgentCaseIds(),
        }))
      }
    }

    void refreshSharedState()
    const intervalId = window.setInterval(() => {
      void refreshSharedState()
    }, URGENT_CASES_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [enabled])

  const updateUrgentIds = useCallback(
    async (ids: string[]) => {
      const normalized = normalizeIds(ids)

      try {
        const next = await saveSharedUrgentState(
          normalized,
          username ?? 'Usuario',
        )
        setState((previous) => applySharedState(previous, next))
        setConnected(true)
        setConnectionError('')
      } catch (error) {
        writeUrgentCaseIds(normalized)
        setState((current) => ({
          ...current,
          urgentIds: normalized,
          actualizadoPor: username,
          actualizadoEn: new Date().toISOString(),
          version: current.version + 1,
        }))
        throw error
      }
    },
    [username],
  )

  return {
    urgentIds: state.urgentIds,
    updatedBy: state.actualizadoPor,
    updatedAt: state.actualizadoEn,
    connected,
    realtimeEnabled: true,
    connectionError,
    updateUrgentIds,
  }
}

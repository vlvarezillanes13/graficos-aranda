import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchSharedTaggedCasesState,
  releaseSharedTaggedCasesSession,
  saveSharedTaggedCasesState,
  setSharedTaggedCasesEditLock,
  setSharedTaggedCasesUnlockKey,
  unlockSharedTaggedCasesSession,
  TAGGED_CASES_POLL_MS,
  TaggedCasesKeyError,
  TaggedCasesLockedError,
  type SharedTaggedCasesState,
  type TaggedCaseKind,
} from '../services/taggedCaseListService'
import {
  normalizeFrenteMap,
  sameFrenteMap,
  type FrenteMap,
} from '../utils/stabilizationCases'
import {
  readStabilizationCases,
  readUrgentCaseIds,
  writeStabilizationCases,
  writeUrgentCaseIds,
} from '../utils/urgentCases'

const estadoInicial: SharedTaggedCasesState = {
  caseIds: [],
  frentes: {},
  actualizadoPor: null,
  actualizadoEn: null,
  version: 0,
  edicionBloqueada: true,
  claveConfigurada: false,
}

function readCached(kind: TaggedCaseKind): {
  ids: string[]
  frentes: FrenteMap
} {
  return kind === 'urgent'
    ? { ids: readUrgentCaseIds(), frentes: {} }
    : readStabilizationCases()
}

function writeCachedIds(
  kind: TaggedCaseKind,
  ids: string[],
  frentes: FrenteMap = {},
): void {
  if (kind === 'urgent') {
    writeUrgentCaseIds(ids)
    return
  }
  writeStabilizationCases(ids, frentes)
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

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((id, index) => id === b[index])
}

function applySharedState(
  kind: TaggedCaseKind,
  previous: SharedTaggedCasesState,
  next: SharedTaggedCasesState,
): SharedTaggedCasesState {
  if (
    next.version !== undefined &&
    previous.version !== undefined &&
    next.version < previous.version
  ) {
    return previous
  }

  if (
    next.version === previous.version &&
    sameIds(next.caseIds, previous.caseIds) &&
    sameFrenteMap(next.frentes, previous.frentes) &&
    next.actualizadoPor === previous.actualizadoPor &&
    next.actualizadoEn === previous.actualizadoEn &&
    next.edicionBloqueada === previous.edicionBloqueada &&
    next.claveConfigurada === previous.claveConfigurada
  ) {
    return previous
  }

  if (
    next.version === previous.version &&
    previous.caseIds.length > 0 &&
    next.caseIds.length === 0 &&
    !next.actualizadoEn
  ) {
    return previous
  }

  writeCachedIds(kind, next.caseIds, next.frentes)
  return next
}

export function useSharedTaggedCases(
  kind: TaggedCaseKind,
  username: string | null,
  enabled: boolean,
) {
  const [state, setState] = useState<SharedTaggedCasesState>(() => {
    const cached = enabled ? readCached(kind) : { ids: [], frentes: {} }
    return { ...estadoInicial, caseIds: cached.ids, frentes: cached.frentes }
  })
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const savingRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      setConnected(false)
      setConnectionError('')
      return
    }

    let cancelled = false

    async function refreshSharedState() {
      if (savingRef.current) return

      try {
        const next = await fetchSharedTaggedCasesState(kind)
        if (cancelled || savingRef.current) return
        setState((previous) => applySharedState(kind, previous, next))
        setConnected(true)
        setConnectionError('')
      } catch (error) {
        if (cancelled) return
        setConnected(false)
        setConnectionError(
          error instanceof Error
            ? error.message
            : `No fue posible sincronizar ${kind === 'urgent' ? 'urgentes' : 'estabilización'}`,
        )
        setState((current) => {
          const cached = readCached(kind)
          if (
            sameIds(current.caseIds, cached.ids) &&
            sameFrenteMap(current.frentes, cached.frentes)
          ) {
            return current
          }
          return { ...current, caseIds: cached.ids, frentes: cached.frentes }
        })
      }
    }

    void refreshSharedState()
    const intervalId = window.setInterval(() => {
      void refreshSharedState()
    }, TAGGED_CASES_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [enabled, kind])

  const updateCaseIds = useCallback(
    async (ids: string[], frentes?: FrenteMap) => {
      const normalized = normalizeIds(ids)
      const normalizedFrentes =
        frentes === undefined ? undefined : normalizeFrenteMap(frentes, normalized)
      savingRef.current = true

      try {
        const next = await saveSharedTaggedCasesState(
          kind,
          normalized,
          username ?? 'Usuario',
          normalizedFrentes,
        )
        setState((previous) => applySharedState(kind, previous, next))
        setConnected(true)
        setConnectionError('')
      } catch (error) {
        if (
          error instanceof TaggedCasesLockedError ||
          error instanceof TaggedCasesKeyError
        ) {
          if (error instanceof TaggedCasesLockedError) {
            setState((current) =>
              current.edicionBloqueada
                ? current
                : { ...current, edicionBloqueada: true },
            )
          }
          throw error
        }

        const fallbackFrentes =
          normalizedFrentes ??
          normalizeFrenteMap(readCached(kind).frentes, normalized)
        writeCachedIds(kind, normalized, fallbackFrentes)
        setState((current) => ({
          ...current,
          caseIds: normalized,
          frentes: fallbackFrentes,
          actualizadoPor: username,
          actualizadoEn: new Date().toISOString(),
          version: current.version + 1,
        }))
        throw error
      } finally {
        savingRef.current = false
      }
    },
    [kind, username],
  )

  const setEditLock = useCallback(
    async (locked: boolean) => {
      savingRef.current = true

      try {
        const next = await setSharedTaggedCasesEditLock(
          kind,
          locked,
          username ?? 'Usuario',
        )
        setState((previous) => applySharedState(kind, previous, next))
        setConnected(true)
        setConnectionError('')
      } finally {
        savingRef.current = false
      }
    },
    [kind, username],
  )

  const setUnlockKey = useCallback(
    async (claveHash: string) => {
      await setSharedTaggedCasesUnlockKey(kind, claveHash)
      setState((current) =>
        current.claveConfigurada
          ? current
          : { ...current, claveConfigurada: true },
      )
    },
    [kind],
  )

  const unlockSession = useCallback(
    async (claveHash: string) => {
      await unlockSharedTaggedCasesSession(kind, claveHash)
    },
    [kind],
  )

  const releaseSession = useCallback(async () => {
    try {
      await releaseSharedTaggedCasesSession(kind)
    } catch {
      // Cerrar el modal no debe fallar si el servidor ya no tiene el permiso.
    }
  }, [kind])

  return {
    caseIds: state.caseIds,
    frentes: state.frentes,
    updatedBy: state.actualizadoPor,
    updatedAt: state.actualizadoEn,
    updatesLocked: state.edicionBloqueada,
    keyConfigured: state.claveConfigurada,
    connected,
    realtimeEnabled: true,
    connectionError,
    updateCaseIds,
    setEditLock,
    setUnlockKey,
    unlockSession,
    releaseSession,
  }
}

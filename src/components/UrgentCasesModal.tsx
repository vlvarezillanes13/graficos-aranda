import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ItemDeliveryDates } from '../types/additionalField'
import type { IncidentItem } from '../types/incident'
import {
  downloadStabilizationCasesXlsx,
  downloadUrgentCasesXlsx,
} from '../utils/exportXlsx'
import {
  filterUrgentItems,
  formatUrgentCaseIds,
  getMissingUrgentIds,
  parseUrgentCaseIds,
} from '../utils/urgentCases'
import { fetchDeliveryDatesForItems } from '../services/deliveryDatesService'
import { sha256Hex } from '../utils/crypto'
import { ItemsTable } from './ItemsTable'

export type CaseListModalVariant = 'urgent' | 'stabilization'

const VARIANT_COPY: Record<
  CaseListModalVariant,
  {
    title: string
    titleId: string
    inputId: string
    defineKeyId: string
    unlockKeyId: string
    listLabel: string
    emptyMessage: string
    exportError: string
    kvKey: string
  }
> = {
  urgent: {
    title: 'Casos urgentes',
    titleId: 'urgent-modal-title',
    inputId: 'urgent-cases-input',
    defineKeyId: 'urgent-define-key',
    unlockKeyId: 'urgent-unlock-key',
    listLabel: 'Lista de casos urgentes',
    emptyMessage: 'Aplica una lista de IDs para ver los casos urgentes',
    exportError: 'No se pudo generar el XLSX de casos urgentes',
    kvKey: 'graficos:urgent-unlock-key',
  },
  stabilization: {
    title: 'Casos de estabilización',
    titleId: 'stabilization-modal-title',
    inputId: 'stabilization-cases-input',
    defineKeyId: 'stabilization-define-key',
    unlockKeyId: 'stabilization-unlock-key',
    listLabel: 'Lista de casos de estabilización',
    emptyMessage:
      'Aplica una lista de IDs para ver los casos de estabilización',
    exportError: 'No se pudo generar el XLSX de casos de estabilización',
    kvKey: 'graficos:stabilization-unlock-key',
  },
}

interface UrgentCasesModalProps {
  open: boolean
  variant?: CaseListModalVariant
  items: IncidentItem[]
  urgentIds: string[]
  stabilizationIds?: string[]
  fetchedAt?: Date | null
  onUrgentIdsChange: (ids: string[]) => void | Promise<void>
  isAdmin?: boolean
  updatesLocked?: boolean
  keyConfigured?: boolean
  onEditLockChange?: (locked: boolean) => void | Promise<void>
  onSetUnlockKey?: (claveHash: string) => void | Promise<void>
  onUnlockSession?: (claveHash: string) => void | Promise<void>
  onReleaseSession?: () => void | Promise<void>
  connected?: boolean
  realtimeEnabled?: boolean
  connectionError?: string
  updatedBy?: string | null
  updatedAt?: string | null
  deliveryDatesById?: Map<number, ItemDeliveryDates>
  deliveryDatesLoading?: boolean
  onClose: () => void
  onSelect: (item: IncidentItem) => void
}

export function UrgentCasesModal({
  open,
  variant = 'urgent',
  items,
  urgentIds,
  stabilizationIds = [],
  fetchedAt,
  onUrgentIdsChange,
  isAdmin = false,
  updatesLocked = true,
  keyConfigured = false,
  onEditLockChange,
  onSetUnlockKey,
  onUnlockSession,
  onReleaseSession,
  connected = false,
  realtimeEnabled = false,
  connectionError = '',
  updatedBy = null,
  updatedAt = null,
  deliveryDatesById,
  deliveryDatesLoading = false,
  onClose,
  onSelect,
}: UrgentCasesModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingLock, setTogglingLock] = useState(false)
  const [unlockKey, setUnlockKey] = useState('')
  const [sessionUnlocked, setSessionUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [newUnlockKey, setNewUnlockKey] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const caseIds = variant === 'stabilization' ? stabilizationIds : urgentIds
  const dirtyRef = useRef(false)
  const wasOpenRef = useRef(false)
  const sessionHadModalRef = useRef(false)

  // Solo hidratar al abrir, o si llega un cambio remoto y el usuario no está editando.
  // El poll cada 5s no debe borrar lo que se está escribiendo.
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      dirtyRef.current = false
      return
    }

    if (!wasOpenRef.current) {
      setInputValue(formatUrgentCaseIds(caseIds))
      setInputError(null)
      setExportError(null)
      dirtyRef.current = false
      wasOpenRef.current = true
      return
    }

    if (!dirtyRef.current && !saving) {
      setInputValue(formatUrgentCaseIds(caseIds))
    }
  }, [open, caseIds, saving])

  useEffect(() => {
    if (open) {
      sessionHadModalRef.current = true
      return
    }

    setSessionUnlocked(false)
    setUnlockKey('')
    setNewUnlockKey('')
    if (!sessionHadModalRef.current) return
    sessionHadModalRef.current = false
    void onReleaseSession?.()
  }, [open, onReleaseSession])

  useEffect(() => {
    if (!updatesLocked) return
    setSessionUnlocked(false)
    setUnlockKey('')
  }, [updatesLocked])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  const applyIds = useCallback(
    async (ids: string[]) => {
      setSaving(true)
      setInputError(null)

      try {
        await onUrgentIdsChange(ids)
        setInputValue(formatUrgentCaseIds(ids))
        dirtyRef.current = false
      } catch (error) {
        setInputError(
          error instanceof Error
            ? error.message
            : 'No fue posible actualizar la lista compartida',
        )
      } finally {
        setSaving(false)
      }
    },
    [onUrgentIdsChange],
  )

  const handleToggleLock = useCallback(async () => {
    if (!isAdmin || !onEditLockChange) return

    setTogglingLock(true)
    setInputError(null)

    try {
      await onEditLockChange(!updatesLocked)
      if (!updatesLocked) {
        setSessionUnlocked(false)
        setUnlockKey('')
      }
      dirtyRef.current = false
    } catch (error) {
      setInputError(
        error instanceof Error
          ? error.message
          : 'No fue posible cambiar el bloqueo',
      )
    } finally {
      setTogglingLock(false)
    }
  }, [isAdmin, onEditLockChange, updatesLocked])

  const canEdit = !updatesLocked && sessionUnlocked

  const handleUnlockThisDevice = async () => {
    if (updatesLocked || !onUnlockSession) return
    const trimmed = unlockKey.trim()
    if (!trimmed) {
      setInputError('Ingresa la clave para desbloquear este equipo')
      return
    }

    setUnlocking(true)
    setInputError(null)

    try {
      await onUnlockSession(await sha256Hex(trimmed))
      setSessionUnlocked(true)
      setUnlockKey('')
    } catch (error) {
      setSessionUnlocked(false)
      setInputError(
        error instanceof Error
          ? error.message
          : 'No fue posible desbloquear este equipo',
      )
    } finally {
      setUnlocking(false)
    }
  }

  const handleSaveUnlockKey = async () => {
    if (!isAdmin || !onSetUnlockKey) return
    const trimmed = newUnlockKey.trim()
    if (trimmed.length < 6) {
      setInputError('La clave debe tener al menos 6 caracteres')
      return
    }

    setSavingKey(true)
    setInputError(null)

    try {
      await onSetUnlockKey(await sha256Hex(trimmed))
      setNewUnlockKey('')
      setSessionUnlocked(false)
    } catch (error) {
      setInputError(
        error instanceof Error
          ? error.message
          : 'No fue posible guardar la clave en KV',
      )
    } finally {
      setSavingKey(false)
    }
  }

  const handleApplyFromScreen = () => {
    if (!canEdit) return
    const ids = parseUrgentCaseIds(inputValue)
    if (ids.length === 0) {
      setInputError('Ingresa al menos un ID (ej: IM-8892122; RF-8947234)')
      return
    }
    void applyIds(ids)
  }

  const handleClear = () => {
    if (!canEdit) return
    setInputValue('')
    void applyIds([])
  }

  const listedItems = useMemo(
    () => filterUrgentItems(items, caseIds),
    [items, caseIds],
  )

  const missingIds = useMemo(
    () => getMissingUrgentIds(items, caseIds),
    [items, caseIds],
  )

  const handleDownloadXlsx = async () => {
    if (listedItems.length === 0) return

    setExporting(true)
    setExportError(null)

    try {
      const dates = await fetchDeliveryDatesForItems(listedItems)
      if (variant === 'stabilization') {
        await downloadStabilizationCasesXlsx(
          listedItems,
          fetchedAt,
          dates,
          caseIds,
        )
      } else {
        await downloadUrgentCasesXlsx(listedItems, fetchedAt, dates, caseIds)
      }
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : VARIANT_COPY[variant].exportError,
      )
    } finally {
      setExporting(false)
    }
  }

  const connectionLabel = !realtimeEnabled
    ? 'Solo local'
    : connected
      ? 'Sincronizado (API compartida)'
      : 'Sin conexión con el servidor'

  if (!open) return null

  return (
    <div
      className="urgent-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="urgent-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={VARIANT_COPY[variant].titleId}
      >
        <header className="urgent-modal-header">
          <div className="urgent-modal-heading">
            <h2 id={VARIANT_COPY[variant].titleId}>{VARIANT_COPY[variant].title}</h2>
            <p>
              Lista compartida entre todos los usuarios. Un administrador
              habilita la actualización y, en cada equipo, hay que ingresar la
              clave. El permiso vale solo en este equipo mientras el modal
              esté abierto.
            </p>
            <p className="urgent-realtime-status">
              Estado:{' '}
              <strong
                className={
                  connected
                    ? 'urgent-realtime-status--online'
                    : 'urgent-realtime-status--offline'
                }
              >
                {connectionLabel}
              </strong>
              {' · '}
              <strong
                className={
                  canEdit
                    ? 'urgent-lock-status--open'
                    : 'urgent-lock-status--locked'
                }
              >
                {updatesLocked
                  ? 'Actualización bloqueada'
                  : sessionUnlocked
                    ? 'Este equipo desbloqueado'
                    : 'Falta clave en este equipo'}
              </strong>
              {updatedBy && updatedAt && (
                <>
                  {' '}
                  · Actualizado por <strong>{updatedBy}</strong> el{' '}
                  {new Date(updatedAt).toLocaleString()}
                </>
              )}
            </p>
          </div>

          <div className="urgent-modal-actions">
            {caseIds.length > 0 && (
              <span className="urgent-modal-stats">
                <strong>{listedItems.length}</strong> de{' '}
                <strong>{caseIds.length}</strong> encontrados
              </span>
            )}
            <button
              type="button"
              className="ghost-button"
              onClick={() => void handleDownloadXlsx()}
              disabled={listedItems.length === 0 || exporting}
              title={`${listedItems.length} caso${listedItems.length === 1 ? '' : 's'}`}
            >
              {exporting ? 'Preparando XLSX...' : 'Descargar XLSX'}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onClose}
              aria-label="Cerrar"
            >
              Cerrar
            </button>
          </div>
        </header>

        <div className="urgent-modal-body">
          {exportError && (
            <p className="urgent-input-error" role="alert">
              {exportError}
            </p>
          )}

          {connectionError && (
            <div className="alert info urgent-missing-alert" role="status">
              <p>{connectionError}</p>
            </div>
          )}

          <div className="urgent-input-panel">
            <div className="urgent-input-panel-header">
              <label
                className="urgent-input-label"
                htmlFor={VARIANT_COPY[variant].inputId}
              >
                {VARIANT_COPY[variant].listLabel}
              </label>
              {isAdmin && (
                <button
                  type="button"
                  className={
                    updatesLocked ? 'reporting-button' : 'ghost-button'
                  }
                  onClick={() => void handleToggleLock()}
                  disabled={togglingLock || saving}
                >
                  {togglingLock
                    ? 'Cambiando bloqueo...'
                    : updatesLocked
                      ? 'Permitir actualización'
                      : 'Bloquear actualización'}
                </button>
              )}
            </div>
            {isAdmin && (
              <form
                className="urgent-key-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleSaveUnlockKey()
                }}
              >
                <label
                  className="urgent-input-label"
                  htmlFor={VARIANT_COPY[variant].defineKeyId}
                >
                  Clave KV <code>{VARIANT_COPY[variant].kvKey}</code>
                  {keyConfigured ? ' · configurada' : ' · no configurada'}
                </label>
                <div className="urgent-key-row">
                  <input
                    id={VARIANT_COPY[variant].defineKeyId}
                    className="urgent-key-input"
                    type="password"
                    autoComplete="new-password"
                    value={newUnlockKey}
                    onChange={(event) => {
                      setNewUnlockKey(event.target.value)
                      setInputError(null)
                    }}
                    placeholder="Nueva clave (mín. 6 caracteres)"
                    disabled={savingKey || saving}
                  />
                  <button
                    type="submit"
                    className="ghost-button"
                    disabled={
                      savingKey || saving || newUnlockKey.trim().length < 6
                    }
                  >
                    {savingKey ? 'Guardando...' : 'Guardar en KV'}
                  </button>
                </div>
              </form>
            )}
            {updatesLocked ? (
              <p className="urgent-lock-hint">
                {isAdmin
                  ? 'La lista está bloqueada. Habilítala y luego ingresa la clave en este equipo. Otros equipos del mismo usuario seguirán bloqueados.'
                  : 'Un administrador debe habilitar la actualización. Después ingresa la clave en este equipo.'}
              </p>
            ) : sessionUnlocked ? (
              <p className="urgent-lock-hint is-open">
                Este equipo puede actualizar mientras el modal esté abierto. Al
                cerrarlo, habrá que volver a ingresar la clave.
              </p>
            ) : (
              <form
                className="urgent-key-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleUnlockThisDevice()
                }}
              >
                <label
                  className="urgent-input-label"
                  htmlFor={VARIANT_COPY[variant].unlockKeyId}
                >
                  Clave de este equipo
                </label>
                <div className="urgent-key-row">
                  <input
                    id={VARIANT_COPY[variant].unlockKeyId}
                    className="urgent-key-input"
                    type="password"
                    autoComplete="off"
                    value={unlockKey}
                    onChange={(event) => {
                      setUnlockKey(event.target.value)
                      setInputError(null)
                    }}
                    placeholder="Clave de actualización"
                    disabled={unlocking || saving}
                  />
                  <button
                    type="submit"
                    className="reporting-button"
                    disabled={unlocking || saving || unlockKey.trim().length === 0}
                  >
                    {unlocking ? 'Validando...' : 'Desbloquear este equipo'}
                  </button>
                </div>
                <p className="urgent-lock-hint">
                  La clave no habilita otros computadores. El mismo usuario en
                  otro equipo debe ingresarla allí.
                </p>
              </form>
            )}
            <textarea
              id={VARIANT_COPY[variant].inputId}
              className="urgent-input"
              value={inputValue}
              onChange={(event) => {
                dirtyRef.current = true
                setInputValue(event.target.value)
                setInputError(null)
              }}
              placeholder="IM-8892122; IM-8970477; RF-8947234"
              rows={4}
              disabled={saving || !canEdit}
            />
            {inputError && (
              <p className="urgent-input-error" role="alert">
                {inputError}
              </p>
            )}
            <div className="urgent-input-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={handleApplyFromScreen}
                disabled={saving || !canEdit || togglingLock}
                title={
                  !canEdit
                    ? 'Habilita la actualización y desbloquea este equipo con la clave'
                    : undefined
                }
              >
                {saving ? 'Aplicando para todos...' : 'Aplicar para todos'}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleClear}
                disabled={
                  saving ||
                  !canEdit ||
                  (!inputValue && caseIds.length === 0)
                }
                title={
                  !canEdit
                    ? 'Habilita la actualización y desbloquea este equipo con la clave'
                    : undefined
                }
              >
                Limpiar
              </button>
            </div>
          </div>

          {caseIds.length > 0 && missingIds.length > 0 && (
            <div className="alert info urgent-missing-alert" role="status">
              <p>
                {missingIds.length} caso{missingIds.length === 1 ? '' : 's'} no{' '}
                {missingIds.length === 1 ? 'está' : 'están'} en los datos
                cargados:{' '}
                <span className="mono">{missingIds.join(', ')}</span>
              </p>
            </div>
          )}

          <ItemsTable
            items={listedItems}
            onSelect={onSelect}
            emptyMessage={VARIANT_COPY[variant].emptyMessage}
            deliveryDatesById={deliveryDatesById}
            deliveryDatesLoading={deliveryDatesLoading}
            urgentIds={urgentIds}
            stabilizationIds={stabilizationIds}
          />
        </div>
      </div>
    </div>
  )
}

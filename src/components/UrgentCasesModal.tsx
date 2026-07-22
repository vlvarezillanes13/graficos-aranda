import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ItemDeliveryDates } from '../types/additionalField'
import type { IncidentItem } from '../types/incident'
import { downloadUrgentCasesXlsx } from '../utils/exportXlsx'
import {
  filterUrgentItems,
  formatUrgentCaseIds,
  getMissingUrgentIds,
  parseUrgentCaseIds,
} from '../utils/urgentCases'
import { fetchDeliveryDatesForItems } from '../services/deliveryDatesService'
import { ItemsTable } from './ItemsTable'

interface UrgentCasesModalProps {
  open: boolean
  items: IncidentItem[]
  urgentIds: string[]
  fetchedAt?: Date | null
  onUrgentIdsChange: (ids: string[]) => void | Promise<void>
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
  items,
  urgentIds,
  fetchedAt,
  onUrgentIdsChange,
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
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setInputValue(formatUrgentCaseIds(urgentIds))
    setInputError(null)
  }, [open, urgentIds])

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

  const handleApplyFromScreen = () => {
    const ids = parseUrgentCaseIds(inputValue)
    if (ids.length === 0) {
      setInputError('Ingresa al menos un ID (ej: IM-8892122; RF-8947234)')
      return
    }
    void applyIds(ids)
  }

  const handleClear = () => {
    setInputValue('')
    void applyIds([])
  }

  const urgentItems = useMemo(
    () => filterUrgentItems(items, urgentIds),
    [items, urgentIds],
  )

  const missingIds = useMemo(
    () => getMissingUrgentIds(items, urgentIds),
    [items, urgentIds],
  )

  const handleDownloadXlsx = async () => {
    if (urgentItems.length === 0) return

    setExporting(true)
    try {
      const dates = await fetchDeliveryDatesForItems(urgentItems)
      downloadUrgentCasesXlsx(urgentItems, fetchedAt, dates)
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
        aria-labelledby="urgent-modal-title"
      >
        <header className="urgent-modal-header">
          <div className="urgent-modal-heading">
            <h2 id="urgent-modal-title">Casos urgentes</h2>
            <p>
              Lista compartida entre todos los usuarios conectados. Al aplicar,
              todos ven la misma selección.
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
            {urgentIds.length > 0 && (
              <span className="urgent-modal-stats">
                <strong>{urgentItems.length}</strong> de{' '}
                <strong>{urgentIds.length}</strong> encontrados
              </span>
            )}
            <button
              type="button"
              className="ghost-button"
              onClick={() => void handleDownloadXlsx()}
              disabled={urgentItems.length === 0 || exporting}
              title={`${urgentItems.length} caso${urgentItems.length === 1 ? '' : 's'}`}
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
          {connectionError && (
            <div className="alert info urgent-missing-alert" role="status">
              <p>{connectionError}</p>
            </div>
          )}

          <div className="urgent-input-panel">
            <label className="urgent-input-label" htmlFor="urgent-cases-input">
              Lista de casos urgentes
            </label>
            <textarea
              id="urgent-cases-input"
              className="urgent-input"
              value={inputValue}
              onChange={(event) => {
                setInputValue(event.target.value)
                setInputError(null)
              }}
              placeholder="IM-8892122; IM-8970477; RF-8947234"
              rows={4}
              disabled={saving}
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
                disabled={saving}
              >
                {saving ? 'Aplicando para todos...' : 'Aplicar para todos'}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleClear}
                disabled={saving || (!inputValue && urgentIds.length === 0)}
              >
                Limpiar
              </button>
            </div>
          </div>

          {urgentIds.length > 0 && missingIds.length > 0 && (
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
            items={urgentItems}
            onSelect={onSelect}
            emptyMessage="Aplica una lista de IDs para ver los casos urgentes"
            deliveryDatesById={deliveryDatesById}
            deliveryDatesLoading={deliveryDatesLoading}
          />
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { IncidentItem } from '../types/incident'
import {
  filterUrgentItems,
  formatUrgentCaseIds,
  getMissingUrgentIds,
  parseUrgentCaseIds,
  readUrgentCaseIds,
  writeUrgentCaseIds,
} from '../utils/urgentCases'
import { ItemsTable } from './ItemsTable'

interface UrgentCasesModalProps {
  open: boolean
  items: IncidentItem[]
  urgentIds: string[]
  onUrgentIdsChange: (ids: string[]) => void
  onClose: () => void
  onSelect: (item: IncidentItem) => void
}

export function UrgentCasesModal({
  open,
  items,
  urgentIds,
  onUrgentIdsChange,
  onClose,
  onSelect,
}: UrgentCasesModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)

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
    (ids: string[]) => {
      writeUrgentCaseIds(ids)
      onUrgentIdsChange(ids)
      setInputValue(formatUrgentCaseIds(ids))
      setInputError(null)
    },
    [onUrgentIdsChange],
  )

  const handleApplyFromScreen = () => {
    const ids = parseUrgentCaseIds(inputValue)
    if (ids.length === 0) {
      setInputError('Ingresa al menos un ID (ej: IM-8892122; RF-8947234)')
      return
    }
    applyIds(ids)
  }

  const handleLoadFromSession = () => {
    const ids = readUrgentCaseIds()
    applyIds(ids)
    if (ids.length === 0) {
      setInputError('No hay IDs guardados en sessionStorage (graficos_urgent_cases)')
    }
  }

  const handleClear = () => {
    setInputValue('')
    applyIds([])
  }

  const urgentItems = useMemo(
    () => filterUrgentItems(items, urgentIds),
    [items, urgentIds],
  )

  const missingIds = useMemo(
    () => getMissingUrgentIds(items, urgentIds),
    [items, urgentIds],
  )

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
            <p>Pega los IDs desde pantalla o cárgalos desde sessionStorage.</p>
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
              onClick={onClose}
              aria-label="Cerrar"
            >
              Cerrar
            </button>
          </div>
        </header>

        <div className="urgent-modal-body">
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
              >
                Aplicar lista
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleLoadFromSession}
              >
                Cargar desde sesión
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleClear}
                disabled={!inputValue && urgentIds.length === 0}
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
          />
        </div>
      </div>
    </div>
  )
}

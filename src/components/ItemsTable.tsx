import { useEffect, useMemo, useState } from 'react'
import type { ItemDeliveryDates } from '../types/additionalField'
import type { IncidentItem } from '../types/incident'
import { formatDate } from '../utils/aggregations'
import {
  formatDeliveryDate,
  formatDeliveryTestDate,
  formatTestAprobadoDate,
  formatUltimaIteracionDate,
  formatPendienteSuspendidoDate,
  getDeliveryDateTimestamp,
  getDeliveryTestTimestamp,
  getTestAprobadoTimestamp,
  getUltimaIteracionTimestamp,
  getPendienteSuspendidoTimestamp,
} from '../utils/deliveryDates'
import { getFrente, type FrenteMap } from '../utils/stabilizationCases'
import { CopyableTicketId } from './CopyableTicketId'

interface ItemsTableProps {
  items: IncidentItem[]
  onSelect?: (item: IncidentItem) => void
  emptyMessage?: string
  deliveryDatesById?: Map<number, ItemDeliveryDates>
  deliveryDatesLoading?: boolean
  urgentIds?: string[]
  stabilizationIds?: string[]
  /** ticket (MAYÚSCULAS) -> frente de estabilización. */
  frentes?: FrenteMap
  /** Muestra la columna Frente (reporte de casos de estabilización). */
  showFrente?: boolean
}

type SortKey =
  | 'idByProject'
  | 'frente'
  | 'openedDate'
  | 'deliveryDate'
  | 'deliveryTestDate'
  | 'ultimaIteracion'
  | 'testAprobado'
  | 'pendienteSuspendido'
  | 'stateName'
  | 'priorityName'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/** Opciones del selector de orden que reemplaza los encabezados en móvil. */
const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'idByProject', label: 'ID' },
  { key: 'frente', label: 'Frente' },
  { key: 'stateName', label: 'Estado' },
  { key: 'priorityName', label: 'Prioridad' },
  { key: 'openedDate', label: 'Apertura' },
  { key: 'deliveryDate', label: 'Fecha de Entrega' },
  { key: 'deliveryTestDate', label: 'Fecha Entrega TEST' },
  { key: 'ultimaIteracion', label: 'Fecha Gestión AFC' },
  { key: 'testAprobado', label: 'Fecha Test Aprobado' },
  { key: 'pendienteSuspendido', label: 'Fecha Pendiente Suspendido' },
]

function getSortValue(
  item: IncidentItem,
  key: SortKey,
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
  frentes?: FrenteMap,
): string | number {
  if (key === 'frente') {
    return getFrente(frentes, item.idByProject)
  }

  if (key === 'deliveryDate') {
    return getDeliveryDateTimestamp(item, deliveryDatesById) ?? 0
  }

  if (key === 'deliveryTestDate') {
    return getDeliveryTestTimestamp(item, deliveryDatesById) ?? 0
  }

  if (key === 'ultimaIteracion') {
    return getUltimaIteracionTimestamp(item, deliveryDatesById) ?? 0
  }

  if (key === 'testAprobado') {
    return getTestAprobadoTimestamp(item, deliveryDatesById) ?? 0
  }

  if (key === 'pendienteSuspendido') {
    return getPendienteSuspendidoTimestamp(item, deliveryDatesById) ?? 0
  }

  return item[key]
}

export function ItemsTable({
  items,
  onSelect,
  emptyMessage = 'No hay registros con los filtros actuales',
  deliveryDatesById,
  deliveryDatesLoading = false,
  urgentIds = [],
  stabilizationIds = [],
  frentes,
  showFrente = false,
}: ItemsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('openedDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const urgentIdSet = useMemo(
    () => new Set(urgentIds.map((id) => id.trim().toUpperCase()).filter(Boolean)),
    [urgentIds],
  )
  const stabilizationIdSet = useMemo(
    () =>
      new Set(
        stabilizationIds.map((id) => id.trim().toUpperCase()).filter(Boolean),
      ),
    [stabilizationIds],
  )

  const itemsIdentity = useMemo(
    () =>
      items
        .map((item) => item.id)
        .sort((a, b) => a - b)
        .join(','),
    [items],
  )

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = getSortValue(a, sortKey, deliveryDatesById, frentes)
      const bVal = getSortValue(b, sortKey, deliveryDatesById, frentes)

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }

      const aStr = String(aVal ?? '')
      const bStr = String(bVal ?? '')
      return sortDir === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr)
    })
  }, [items, sortKey, sortDir, deliveryDatesById, frentes])

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  useEffect(() => {
    setPage(1)
  }, [itemsIdentity, sortKey, sortDir, pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedItems.slice(start, start + pageSize)
  }, [sortedItems, currentPage, pageSize])

  const rangeStart =
    sortedItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, sortedItems.length)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('desc')
  }

  const sortOptions = useMemo(
    () =>
      SORT_OPTIONS.filter((option) => showFrente || option.key !== 'frente'),
    [showFrente],
  )

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div className="items-table-content">
      <div className="items-mobile-sort">
        <label className="page-size-field">
          <span>Ordenar por</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ghost-button"
          onClick={() => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))}
          aria-label={
            sortDir === 'asc' ? 'Orden ascendente' : 'Orden descendente'
          }
        >
          {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

      <div className="table-wrapper">
        <table className="items-table">
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => toggleSort('idByProject')}>
                  ID{sortIndicator('idByProject')}
                </button>
              </th>
              {showFrente && (
                <th>
                  <button type="button" onClick={() => toggleSort('frente')}>
                    Frente{sortIndicator('frente')}
                  </button>
                </th>
              )}
              <th>Asunto</th>
              <th>Tipo</th>
              <th>Grupo</th>
              <th>Responsable</th>
              <th>
                <button type="button" onClick={() => toggleSort('stateName')}>
                  Estado{sortIndicator('stateName')}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort('priorityName')}>
                  Prioridad{sortIndicator('priorityName')}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort('openedDate')}>
                  Apertura{sortIndicator('openedDate')}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort('deliveryDate')}>
                  Fecha de Entrega{sortIndicator('deliveryDate')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  onClick={() => toggleSort('deliveryTestDate')}
                >
                  Fecha Entrega TEST{sortIndicator('deliveryTestDate')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  onClick={() => toggleSort('ultimaIteracion')}
                >
                  Fecha Gestión AFC{sortIndicator('ultimaIteracion')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  onClick={() => toggleSort('testAprobado')}
                >
                  Fecha Test Aprobado{sortIndicator('testAprobado')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  onClick={() => toggleSort('pendienteSuspendido')}
                >
                  Fecha Pendiente Suspendido{sortIndicator('pendienteSuspendido')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={showFrente ? 14 : 13} className="empty-row">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
                const ticketId = item.idByProject.trim().toUpperCase()
                const isUrgent = urgentIdSet.has(ticketId)
                const isStabilization = stabilizationIdSet.has(ticketId)

                return (
                <tr
                  key={item.id}
                  className={[
                    'clickable-row',
                    isUrgent ? 'is-urgent' : '',
                    isStabilization ? 'is-stabilization' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelect?.(item)}
                >
                  <td className="mono ticket-id-cell" data-label="ID">
                    <div className="ticket-id-row">
                      <CopyableTicketId value={item.idByProject} />
                      {isUrgent && (
                        <span className="urgent-badge" title="Caso urgente">
                          Urgente
                        </span>
                      )}
                      {isStabilization && (
                        <span
                          className="stabilization-badge"
                          title="Caso de estabilización"
                        >
                          Estabilización
                        </span>
                      )}
                    </div>
                  </td>
                  {showFrente && (
                    <td className="frente-cell" data-label="Frente">
                      {getFrente(frentes, item.idByProject)}
                    </td>
                  )}
                  <td className="subject-cell" data-label="Asunto">
                    {item.subject}
                  </td>
                  <td data-label="Tipo">
                    <span className="pill">{item.itemTypeName}</span>
                  </td>
                  <td data-label="Grupo">{item.groupName}</td>
                  <td data-label="Responsable">{item.responsibleName}</td>
                  <td data-label="Estado">
                    <span
                      className={`status-pill ${item.isClosed ? 'closed' : 'open'}`}
                    >
                      {item.stateName}
                    </span>
                  </td>
                  <td data-label="Prioridad">{item.priorityName}</td>
                  <td data-label="Apertura">{formatDate(item.openedDate)}</td>
                  <td data-label="Fecha de Entrega">
                    {formatDeliveryDate(item, deliveryDatesById)}
                  </td>
                  <td data-label="Fecha Entrega TEST">
                    {formatDeliveryTestDate(item, deliveryDatesById)}
                  </td>
                  <td data-label="Fecha Gestión AFC">
                    {formatUltimaIteracionDate(item, deliveryDatesById)}
                  </td>
                  <td data-label="Fecha Test Aprobado">
                    {formatTestAprobadoDate(item, deliveryDatesById)}
                  </td>
                  <td data-label="Fecha Pendiente Suspendido">
                    {formatPendienteSuspendidoDate(item, deliveryDatesById)}
                  </td>
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {sortedItems.length > 0 && (
        <div className="table-pagination">
          <p>
            Mostrando <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> de{' '}
            <strong>{sortedItems.length}</strong> registros
            {deliveryDatesLoading ? ' · cargando fechas de entrega...' : ''}
          </p>

          <div className="table-pagination-controls">
            <label className="page-size-field">
              <span>Por página</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <div className="page-buttons">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPage(1)}
                disabled={currentPage === 1}
              >
                «
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPage((value) => value - 1)}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              <span className="page-indicator">
                Página {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPage((value) => value + 1)}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                »
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { IncidentItem } from '../types/incident'
import { formatDate } from '../utils/aggregations'

interface ItemsTableProps {
  items: IncidentItem[]
  onSelect?: (item: IncidentItem) => void
  emptyMessage?: string
}

type SortKey =
  | 'idByProject'
  | 'openedDate'
  | 'expectedDate'
  | 'stateName'
  | 'priorityName'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function ItemsTable({
  items,
  onSelect,
  emptyMessage = 'No hay registros con los filtros actuales',
}: ItemsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('openedDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }

      const aStr = String(aVal ?? '')
      const bStr = String(bVal ?? '')
      return sortDir === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr)
    })
  }, [items, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  useEffect(() => {
    setPage(1)
  }, [items, sortKey, sortDir, pageSize])

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

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div className="items-table-content">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => toggleSort('idByProject')}>
                  ID{sortIndicator('idByProject')}
                </button>
              </th>
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
                <button type="button" onClick={() => toggleSort('expectedDate')}>
                  Fecha de Entrega{sortIndicator('expectedDate')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-row">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => (
                <tr
                  key={item.id}
                  className="clickable-row"
                  onClick={() => onSelect?.(item)}
                >
                  <td className="mono">{item.idByProject}</td>
                  <td className="subject-cell">{item.subject}</td>
                  <td>
                    <span className="pill">{item.itemTypeName}</span>
                  </td>
                  <td>{item.groupName}</td>
                  <td>{item.responsibleName}</td>
                  <td>
                    <span
                      className={`status-pill ${item.isClosed ? 'closed' : 'open'}`}
                    >
                      {item.stateName}
                    </span>
                  </td>
                  <td>{item.priorityName}</td>
                  <td>{formatDate(item.openedDate)}</td>
                  <td>
                    {formatDate(item.expectedDate > 0 ? item.expectedDate : null)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sortedItems.length > 0 && (
        <div className="table-pagination">
          <p>
            Mostrando <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> de{' '}
            <strong>{sortedItems.length}</strong> registros
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

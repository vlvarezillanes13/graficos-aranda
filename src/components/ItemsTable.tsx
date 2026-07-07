import { useMemo, useState } from 'react'
import type { IncidentItem } from '../types/incident'
import { formatDate } from '../utils/aggregations'

interface ItemsTableProps {
  items: IncidentItem[]
  onSelect?: (item: IncidentItem) => void
}

type SortKey =
  | 'idByProject'
  | 'openedDate'
  | 'stateName'
  | 'priorityName'

export function ItemsTable({ items, onSelect }: ItemsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('openedDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

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
    <section className="table-section">
      <div className="table-header">
        <div>
          <h2>Detalle de tickets</h2>
          <p>Haz clic en una fila para ver el detalle completo</p>
        </div>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-row">
                  No hay registros con los filtros actuales
                </td>
              </tr>
            ) : (
              sortedItems.map((item) => (
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

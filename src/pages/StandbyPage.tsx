import { useMemo, useState } from 'react'
import { FilterBar } from '../components/FilterBar'
import { ItemsTable } from '../components/ItemsTable'
import { LoadingState } from '../components/LoadingState'
import { SummaryCards } from '../components/SummaryCards'
import type { ItemDeliveryDates } from '../types/additionalField'
import type { IncidentItem } from '../types/incident'
import {
  filterItems,
  getSummary,
  getUniqueValues,
  type FilterState,
} from '../utils/aggregations'

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: 'all',
  itemType: 'all',
  group: 'all',
  state: 'all',
  responsible: 'all',
}

interface StandbyPageProps {
  loading: boolean
  error: string | null
  fetchedAt: Date | null
  items: IncidentItem[]
  deliveryDatesById: Map<number, ItemDeliveryDates>
  deliveryDatesLoading: boolean
  urgentIds: string[]
  onSelectItem: (item: IncidentItem) => void
}

export function StandbyPage({
  loading,
  error,
  fetchedAt,
  items,
  deliveryDatesById,
  deliveryDatesLoading,
  urgentIds,
  onSelectItem,
}: StandbyPageProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const filteredItems = useMemo(
    () => filterItems(items, filters),
    [items, filters],
  )

  const summary = useMemo(() => getSummary(filteredItems), [filteredItems])

  const itemTypes = useMemo(
    () => getUniqueValues(items, 'itemTypeName'),
    [items],
  )
  const groups = useMemo(() => getUniqueValues(items, 'groupName'), [items])
  const states = useMemo(() => getUniqueValues(items, 'stateName'), [items])
  const responsibles = useMemo(
    () => getUniqueValues(items, 'responsibleName'),
    [items],
  )

  return (
    <>
      <header className="hero hero-standby">
        <div className="hero-content">
          <p className="eyebrow">ITSM SONDA · Standby</p>
          <h1>Tickets en categoría Standby</h1>
          <p className="subtitle">
            Listado aparte de tickets con categoría Standby. No se incluyen en
            el panel operativo ni en el reporte completo.
          </p>
          {fetchedAt && !loading && (
            <p className="last-update">
              Última actualización:{' '}
              {new Intl.DateTimeFormat('es-CL', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(fetchedAt)}
            </p>
          )}
        </div>
      </header>

      <main className="app standby-page">
        {loading && <LoadingState />}

        {error && (
          <div className="alert error" role="alert">
            <strong>No se pudieron cargar los datos.</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="dashboard-sections">
            <SummaryCards {...summary} totalItems={items.length} />

            <FilterBar
              filters={filters}
              itemTypes={itemTypes}
              groups={groups}
              states={states}
              responsibles={responsibles}
              resultCount={filteredItems.length}
              totalCount={items.length}
              onChange={setFilters}
              onReset={() => setFilters(DEFAULT_FILTERS)}
            />

            <section className="standby-panel panel">
              <header className="standby-panel-header">
                <div>
                  <h2>Listado Standby</h2>
                  <p>
                    Mostrando {filteredItems.length} de {items.length} ticket
                    {items.length === 1 ? '' : 's'}
                  </p>
                </div>
              </header>

              <div className="standby-panel-body">
                <ItemsTable
                  items={filteredItems}
                  onSelect={onSelectItem}
                  emptyMessage="No hay tickets Standby con los filtros actuales"
                  deliveryDatesById={deliveryDatesById}
                  deliveryDatesLoading={deliveryDatesLoading}
                  urgentIds={urgentIds}
                />
              </div>
            </section>
          </div>
        )}
      </main>
    </>
  )
}

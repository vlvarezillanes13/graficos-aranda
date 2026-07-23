import { useCallback, useState } from 'react'
import { BarCountChart, PieCountChart } from '../components/CountChart'
import { FilterBar } from '../components/FilterBar'
import { ItemsTable } from '../components/ItemsTable'
import { LoadingState } from '../components/LoadingState'
import { ResponsibleStateMatrixTable } from '../components/ResponsibleStateMatrix'
import { SummaryCards } from '../components/SummaryCards'
import type { ItemDeliveryDates } from '../types/additionalField'
import type { CountItem, GroupField, IncidentItem } from '../types/incident'
import type {
  DashboardSummary,
  FilterState,
  MatrixSelection,
} from '../utils/aggregations'

const GROUP_OPTIONS: { value: GroupField; label: string }[] = [
  { value: 'responsibleName', label: 'Responsable' },
  { value: 'groupName', label: 'Grupo' },
  { value: 'itemTypeName', label: 'Tipo de ítem' },
  { value: 'stateName', label: 'Estado' },
  { value: 'priorityName', label: 'Prioridad' },
  { value: 'categoryName', label: 'Categoría' },
]

type DashboardTab = 'table' | 'analysis' | 'matrix'

interface DashboardPageProps {
  loading: boolean
  error: string | null
  fetchedAt: Date | null
  totalItems: number
  summary: DashboardSummary
  filters: FilterState
  itemTypes: string[]
  groups: string[]
  states: string[]
  responsibles: string[]
  filteredItems: IncidentItem[]
  items: IncidentItem[]
  customField: GroupField
  chartType: 'bar' | 'pie'
  customGrouped: CountItem[]
  responsibleStateMatrix: ReturnType<
    typeof import('../utils/aggregations').buildResponsibleByStateMatrix
  >
  matrixSelection: MatrixSelection
  deliveryDatesById: Map<number, ItemDeliveryDates>
  deliveryDatesLoading: boolean
  onFiltersChange: (filters: FilterState) => void
  onFiltersReset: () => void
  onCustomFieldChange: (field: GroupField) => void
  onChartTypeChange: (type: 'bar' | 'pie') => void
  onMatrixSelect: (selection: MatrixSelection) => void
  onSelectItem: (item: IncidentItem) => void
}

const DASHBOARD_TABS: Array<{
  id: DashboardTab
  label: string
  hint: string
  icon: string
  modifier: 'table' | 'analysis' | 'matrix'
}> = [
  {
    id: 'table',
    label: 'Detalle de tickets',
    hint: 'Listado filtrado',
    icon: '☰',
    modifier: 'table',
  },
  {
    id: 'analysis',
    label: 'Análisis personalizado',
    hint: 'Gráficos y agrupación',
    icon: '◔',
    modifier: 'analysis',
  },
  {
    id: 'matrix',
    label: 'Responsable y estado',
    hint: 'Tabla cruzada',
    icon: '▦',
    modifier: 'matrix',
  },
]

export function DashboardPage({
  loading,
  error,
  fetchedAt,
  totalItems,
  summary,
  filters,
  itemTypes,
  groups,
  states,
  responsibles,
  filteredItems,
  items,
  customField,
  chartType,
  customGrouped,
  responsibleStateMatrix,
  matrixSelection,
  deliveryDatesById,
  deliveryDatesLoading,
  onFiltersChange,
  onFiltersReset,
  onCustomFieldChange,
  onChartTypeChange,
  onMatrixSelect,
  onSelectItem,
}: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('table')

  const customLabel =
    GROUP_OPTIONS.find((option) => option.value === customField)?.label ??
    customField

  const handleMatrixSelect = useCallback(
    (selection: MatrixSelection) => {
      onMatrixSelect(selection)
      setActiveTab('table')

      requestAnimationFrame(() => {
        document
          .getElementById('filter-bar-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },
    [onMatrixSelect],
  )

  const tabBadges: Record<DashboardTab, number> = {
    table: filteredItems.length,
    analysis: customGrouped.length,
    matrix: responsibles.length,
  }

  return (
    <>
      <header className="hero">
        <div className="hero-content">
          <p className="eyebrow">ITSM SONDA · Panel de avance</p>
          <h1>Estado operativo de incidentes y solicitudes</h1>
          <p className="subtitle">
            Monitorea el progreso y la distribución por equipos.
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

      <main className="app">
        {loading && <LoadingState />}

        {error && (
          <div className="alert error" role="alert">
            <strong>No se pudieron cargar los datos.</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="dashboard-sections">
            <SummaryCards {...summary} totalItems={totalItems} />

            <FilterBar
              filters={filters}
              itemTypes={itemTypes}
              groups={groups}
              states={states}
              responsibles={responsibles}
              resultCount={filteredItems.length}
              totalCount={items.length}
              onChange={onFiltersChange}
              onReset={onFiltersReset}
            />

            <section className="dashboard-panel panel">
              <header className="dashboard-panel-header">
                <div>
                  <h2>Vistas del panel</h2>
                  <p>
                    Cambia entre detalle, análisis gráfico y matriz responsable
                    por estado.
                  </p>
                </div>
              </header>

              <div className="dashboard-panel-body">
                <div
                  className="panel-tabs cols-3"
                  role="tablist"
                  aria-label="Vistas del panel operativo"
                >
                  {DASHBOARD_TABS.map((tab) => {
                    const isActive = activeTab === tab.id

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={`dashboard-tab-${tab.id}`}
                        aria-selected={isActive}
                        aria-controls={`dashboard-panel-${tab.id}`}
                        className={[
                          'panel-tab',
                          `is-${tab.modifier}`,
                          isActive ? 'active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <span className="panel-tab-icon" aria-hidden>
                          {tab.icon}
                        </span>
                        <span className="panel-tab-copy">
                          <strong>{tab.label}</strong>
                          <small>{tab.hint}</small>
                        </span>
                        <span
                          className={`panel-tab-badge ${
                            tab.id === 'matrix' ? 'is-muted' : ''
                          }`}
                        >
                          {tabBadges[tab.id]}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {activeTab === 'table' && (
                  <article
                    id="dashboard-panel-table"
                    role="tabpanel"
                    aria-labelledby="dashboard-tab-table"
                    className="panel-tab-panel is-table"
                  >
                    <div className="panel-tab-panel-intro">
                      <h3>Detalle de tickets</h3>
                      <p>
                        Listado filtrado con fechas AFC y entrega. Haz clic en
                        una fila para abrir el detalle completo del ticket.
                      </p>
                    </div>

                    <ItemsTable
                      items={filteredItems}
                      onSelect={onSelectItem}
                      deliveryDatesById={deliveryDatesById}
                      deliveryDatesLoading={deliveryDatesLoading}
                    />
                  </article>
                )}

                {activeTab === 'analysis' && (
                  <article
                    id="dashboard-panel-analysis"
                    role="tabpanel"
                    aria-labelledby="dashboard-tab-analysis"
                    className="panel-tab-panel is-analysis"
                  >
                    <div className="panel-tab-panel-intro">
                      <h3>Análisis personalizado</h3>
                      <p>
                        Agrupa el filtrado actual y explora la distribución en
                        gráfico o tabla resumida.
                      </p>
                    </div>

                    <div className="custom-controls">
                      <div className="controls-row">
                        <label>
                          Agrupar por
                          <select
                            value={customField}
                            onChange={(event) =>
                              onCustomFieldChange(
                                event.target.value as GroupField,
                              )
                            }
                          >
                            {GROUP_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          Tipo de gráfico
                          <select
                            value={chartType}
                            onChange={(event) =>
                              onChartTypeChange(
                                event.target.value as 'bar' | 'pie',
                              )
                            }
                          >
                            <option value="bar">Barras</option>
                            <option value="pie">Circular</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    {chartType === 'bar' ? (
                      <BarCountChart
                        title={`Cantidad por ${customLabel}`}
                        data={customGrouped}
                        color="#6366f1"
                        maxItems={15}
                      />
                    ) : (
                      <PieCountChart
                        title={`Distribución por ${customLabel}`}
                        data={customGrouped}
                        maxItems={8}
                      />
                    )}

                    <div className="table-wrapper compact-table">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>{customLabel}</th>
                            <th>Cantidad</th>
                            <th>% del filtrado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customGrouped.map((row, index) => (
                            <tr key={row.name}>
                              <td>{index + 1}</td>
                              <td>{row.name}</td>
                              <td>{row.count}</td>
                              <td>
                                {summary.total === 0
                                  ? '0%'
                                  : `${((row.count / summary.total) * 100).toFixed(1)}%`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                )}

                {activeTab === 'matrix' && (
                  <article
                    id="dashboard-panel-matrix"
                    role="tabpanel"
                    aria-labelledby="dashboard-tab-matrix"
                    className="panel-tab-panel is-matrix matrix-section"
                  >
                    <div className="panel-tab-panel-intro">
                      <h3>Tickets por responsable y estado</h3>
                      <p>
                        Tabla cruzada sincronizada con los filtros superiores.
                        Haz clic en un número, responsable o estado para
                        filtrar; vuelve a hacer clic para quitar el filtro.
                      </p>
                    </div>

                    <ResponsibleStateMatrixTable
                      matrix={responsibleStateMatrix}
                      activeSelection={matrixSelection}
                      onSelect={handleMatrixSelect}
                    />
                  </article>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </>
  )
}

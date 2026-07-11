import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarCountChart, PieCountChart } from './components/CountChart'
import { FilterBar } from './components/FilterBar'
import { ItemDetailPanel } from './components/ItemDetailPanel'
import { ItemsTable } from './components/ItemsTable'
import { LoadingState } from './components/LoadingState'
import { LoginPage } from './components/LoginPage'
import { SummaryCards } from './components/SummaryCards'
import {
  getSessionUsername,
  logout,
  verifySession,
} from './services/authService'
import { fetchItsmItems } from './services/itsmService'
import type { GroupField, IncidentItem } from './types/incident'
import {
  filterItems,
  getSummary,
  getUniqueValues,
  groupByField,
  type FilterState,
} from './utils/aggregations'
import { downloadIncidentsXlsx, getExportCounts } from './utils/exportXlsx'
import { useIdleTimeout } from './hooks/useIdleTimeout'
import './App.css'

const GROUP_OPTIONS: { value: GroupField; label: string }[] = [
  { value: 'responsibleName', label: 'Responsable' },
  { value: 'groupName', label: 'Grupo' },
  { value: 'itemTypeName', label: 'Tipo de ítem' },
  { value: 'stateName', label: 'Estado' },
  { value: 'priorityName', label: 'Prioridad' },
  { value: 'categoryName', label: 'Categoría' },
]

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: 'all',
  itemType: 'all',
  group: 'all',
  state: 'all',
}

function App() {
  const [authReady, setAuthReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [items, setItems] = useState<IncidentItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [customField, setCustomField] = useState<GroupField>('responsibleName')
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')
  const [selectedItem, setSelectedItem] = useState<IncidentItem | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchItsmItems()
      setItems(result.items)
      setTotalItems(result.totalItems)
      setFetchedAt(result.fetchedAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setItems([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void verifySession().then((valid) => {
      setAuthenticated(valid)
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    if (!authenticated) return
    void loadData()
  }, [authenticated, loadData])

  const filteredItems = useMemo(
    () => filterItems(items, filters),
    [items, filters],
  )

  const summary = useMemo(() => getSummary(filteredItems), [filteredItems])

  const itemTypes = useMemo(() => getUniqueValues(items, 'itemTypeName'), [items])
  const groups = useMemo(() => getUniqueValues(items, 'groupName'), [items])
  const states = useMemo(() => getUniqueValues(items, 'stateName'), [items])

  const customGrouped = useMemo(
    () => groupByField(filteredItems, customField),
    [filteredItems, customField],
  )

  const customLabel =
    GROUP_OPTIONS.find((option) => option.value === customField)?.label ??
    customField

  const exportCounts = useMemo(() => getExportCounts(items), [items])
  const username = getSessionUsername()

  const handleLogout = useCallback(() => {
    logout()
    setAuthenticated(false)
    setItems([])
    setTotalItems(0)
    setError(null)
    setFetchedAt(null)
    setFilters(DEFAULT_FILTERS)
    setSelectedItem(null)
  }, [])

  useIdleTimeout(handleLogout, authenticated)

  if (!authReady) {
    return <LoadingState />
  }

  if (!authenticated) {
    return <LoginPage onSuccess={() => setAuthenticated(true)} />
  }

  return (
    <div className="app-shell">
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

        <div className="hero-actions">
          {!loading && !error && (
            <span className="source-badge itsm">
              {username ? `${username} · ITSM` : 'Conectado a ITSM'}
            </span>
          )}
          <div className="hero-actions-buttons">
            <button
              type="button"
              className="secondary-button"
              onClick={handleLogout}
            >
              Cerrar sesión
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => downloadIncidentsXlsx(items, fetchedAt)}
              disabled={loading || items.length === 0}
              title={`${exportCounts.open} abiertos y ${exportCounts.closed} cerrados`}
            >
              Descargar XLSX ({exportCounts.open}+{exportCounts.closed})
            </button>
            <button type="button" onClick={() => void loadData()} disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar datos'}
            </button>
          </div>
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
          <>
            <SummaryCards {...summary} totalItems={totalItems} />

            <FilterBar
              filters={filters}
              itemTypes={itemTypes}
              groups={groups}
              states={states}
              resultCount={filteredItems.length}
              totalCount={items.length}
              onChange={setFilters}
              onReset={() => setFilters(DEFAULT_FILTERS)}
            />

            <section className="custom-section panel">
              <div className="custom-controls">
                <h2>Análisis personalizado</h2>
                <div className="controls-row">
                  <label>
                    Agrupar por
                    <select
                      value={customField}
                      onChange={(e) =>
                        setCustomField(e.target.value as GroupField)
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
                      onChange={(e) =>
                        setChartType(e.target.value as 'bar' | 'pie')
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
            </section>

            <ItemsTable items={filteredItems} onSelect={setSelectedItem} />
          </>
        )}
      </main>

      <ItemDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  )
}

export default App

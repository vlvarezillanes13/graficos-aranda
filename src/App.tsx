import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarCountChart, PieCountChart } from './components/CountChart'
import { CollapsibleSection } from './components/CollapsibleSection'
import { FilterBar } from './components/FilterBar'
import { ItemDetailPanel } from './components/ItemDetailPanel'
import { ItemsTable } from './components/ItemsTable'
import { LoadingState } from './components/LoadingState'
import { LoginPage } from './components/LoginPage'
import { ResponsibleStateMatrixTable } from './components/ResponsibleStateMatrix'
import { SummaryCards } from './components/SummaryCards'
import { UrgentCasesModal } from './components/UrgentCasesModal'
import {
  getSessionUsername,
  getSessionIsAdmin,
  logout,
  verifySession,
} from './services/authService'
import { fetchItsmItems } from './services/itsmService'
import type { FetchResult } from './types/itsm'
import type { GroupField, IncidentItem } from './types/incident'
import {
  filterItems,
  getSummary,
  getUniqueValues,
  groupByField,
  buildResponsibleByStateMatrix,
  applyMatrixSelectionToFilters,
  clearMatrixSelectionFromFilters,
  filtersToMatrixSelection,
  isMatrixSelectionActive,
  type FilterState,
  type MatrixSelection,
} from './utils/aggregations'
import { downloadIncidentsXlsx, getExportCounts } from './utils/exportXlsx'
import { filterUrgentItems, readUrgentCaseIds } from './utils/urgentCases'
import { useIdleTimeout } from './hooks/useIdleTimeout'
import { useBackgroundRefresh } from './hooks/useBackgroundRefresh'
import { useDeliveryDates } from './hooks/useDeliveryDates'
import {
  clearDeliveryDatesCache,
  fetchDeliveryDatesForItems,
} from './services/deliveryDatesService'
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
  responsible: 'all',
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
  const [urgentModalOpen, setUrgentModalOpen] = useState(false)
  const [urgentIds, setUrgentIds] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!authenticated) return
    setUrgentIds(readUrgentCaseIds())
  }, [authenticated])

  const applyFetchResult = useCallback((result: FetchResult) => {
    setItems(result.items)
    setTotalItems(result.totalItems)
    setFetchedAt(result.fetchedAt)
    setSelectedItem((current) => {
      if (!current) return null
      return result.items.find((item) => item.id === current.id) ?? current
    })
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchItsmItems()
      applyFetchResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setItems([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }, [applyFetchResult])

  const refreshDataInBackground = useCallback(async () => {
    try {
      const result = await fetchItsmItems()
      applyFetchResult(result)
    } catch {
      // Mantener los datos actuales si el refresco en segundo plano falla.
    }
  }, [applyFetchResult])

  useEffect(() => {
    void verifySession().then((valid) => {
      setAuthenticated(valid)
      setIsAdmin(valid && getSessionIsAdmin())
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    if (!authenticated) return
    void loadData()
  }, [authenticated, loadData])

  useBackgroundRefresh(
    refreshDataInBackground,
    authenticated && !loading && items.length > 0,
  )

  const filteredItems = useMemo(
    () => filterItems(items, filters),
    [items, filters],
  )

  const itemsForDeliveryDates = useMemo(() => {
    const byId = new Map<number, IncidentItem>()

    for (const item of filteredItems) {
      byId.set(item.id, item)
    }

    if (selectedItem) {
      byId.set(selectedItem.id, selectedItem)
    }

    return Array.from(byId.values())
  }, [filteredItems, selectedItem])

  const { datesById: deliveryDatesById, loading: deliveryDatesLoading } =
    useDeliveryDates(itemsForDeliveryDates)

  const summary = useMemo(() => getSummary(filteredItems), [filteredItems])

  const itemTypes = useMemo(() => getUniqueValues(items, 'itemTypeName'), [items])
  const groups = useMemo(() => getUniqueValues(items, 'groupName'), [items])
  const states = useMemo(() => getUniqueValues(items, 'stateName'), [items])
  const responsibles = useMemo(
    () => getUniqueValues(items, 'responsibleName'),
    [items],
  )

  const matrixSelection = useMemo(
    () => filtersToMatrixSelection(filters),
    [filters],
  )

  const customGrouped = useMemo(
    () => groupByField(filteredItems, customField),
    [filteredItems, customField],
  )

  const responsibleStateMatrix = useMemo(
    () => buildResponsibleByStateMatrix(filteredItems),
    [filteredItems],
  )

  const customLabel =
    GROUP_OPTIONS.find((option) => option.value === customField)?.label ??
    customField

  const handleExportXlsx = useCallback(async () => {
    if (items.length === 0) return

    setExporting(true)
    try {
      const dates = await fetchDeliveryDatesForItems(items)
      downloadIncidentsXlsx(items, fetchedAt, dates)
    } finally {
      setExporting(false)
    }
  }, [items, fetchedAt])

  const exportCounts = useMemo(() => getExportCounts(items), [items])
  const urgentCount = useMemo(
    () => filterUrgentItems(items, urgentIds).length,
    [items, urgentIds],
  )
  const username = getSessionUsername()

  const handleMatrixSelect = useCallback((selection: MatrixSelection) => {
    setFilters((current) => {
      const active = filtersToMatrixSelection(current)
      if (isMatrixSelectionActive(active, selection)) {
        return clearMatrixSelectionFromFilters(current, selection)
      }
      return applyMatrixSelectionToFilters(current, selection)
    })

    requestAnimationFrame(() => {
      document
        .getElementById('filter-bar-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })

      const section = document.getElementById('items-table-section')
      if (section instanceof HTMLDetailsElement) {
        section.open = true
      }
    })
  }, [])

  const handleLogout = useCallback(() => {
    logout()
    setAuthenticated(false)
    setItems([])
    setTotalItems(0)
    setError(null)
    setFetchedAt(null)
    setFilters(DEFAULT_FILTERS)
    setSelectedItem(null)
    setUrgentIds([])
    setUrgentModalOpen(false)
    setIsAdmin(false)
    clearDeliveryDatesCache()
  }, [])

  useIdleTimeout(handleLogout, authenticated)

  if (!authReady) {
    return <LoadingState />
  }

  if (!authenticated) {
    return (
      <LoginPage
        onSuccess={() => {
          setAuthenticated(true)
          setIsAdmin(getSessionIsAdmin())
        }}
      />
    )
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
              {username
                ? `${username}${isAdmin ? ' · Admin' : ''} · ITSM`
                : 'Conectado a ITSM'}
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
              onClick={() => void handleExportXlsx()}
              disabled={loading || exporting || items.length === 0}
              title={`${exportCounts.open} abiertos y ${exportCounts.closed} cerrados`}
            >
              {exporting
                ? 'Preparando XLSX...'
                : `Descargar XLSX (${exportCounts.open}+${exportCounts.closed})`}
            </button>
            <button
              type="button"
              className="secondary-button urgent-open-button"
              onClick={() => setUrgentModalOpen(true)}
              disabled={loading}
            >
              Casos urgentes{urgentCount > 0 ? ` (${urgentCount})` : ''}
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
              onChange={setFilters}
              onReset={() => setFilters(DEFAULT_FILTERS)}
            />

            <CollapsibleSection
              title="Análisis personalizado"
              description="Gráficos y tabla agrupada según el campo seleccionado."
              defaultOpen={false}
            >
              <div className="custom-controls">
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
            </CollapsibleSection>

            <CollapsibleSection
              id="items-table-section"
              title="Detalle de tickets"
              description="Haz clic en una fila para ver el detalle completo."
              defaultOpen
            >
              <ItemsTable
                items={filteredItems}
                onSelect={setSelectedItem}
                deliveryDatesById={deliveryDatesById}
                deliveryDatesLoading={deliveryDatesLoading}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Tickets por responsable y estado"
              description="Tabla cruzada por persona y estado. Se sincroniza con los filtros de arriba."
              defaultOpen={false}
              className="matrix-section"
            >
              <p className="matrix-hint">
                Usa los filtros superiores o haz clic en un número, responsable o
                estado. Vuelve a hacer clic para quitar el filtro.
              </p>

              <ResponsibleStateMatrixTable
                matrix={responsibleStateMatrix}
                activeSelection={matrixSelection}
                onSelect={handleMatrixSelect}
              />
            </CollapsibleSection>
          </div>
        )}
      </main>

      <UrgentCasesModal
        open={urgentModalOpen}
        items={items}
        urgentIds={urgentIds}
        fetchedAt={fetchedAt}
        onUrgentIdsChange={setUrgentIds}
        onClose={() => setUrgentModalOpen(false)}
        onSelect={setSelectedItem}
      />

      <ItemDetailPanel
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        deliveryDatesById={deliveryDatesById}
        onResponsibleChanged={refreshDataInBackground}
        canAssignResponsible={isAdmin}
      />
    </div>
  )
}

export default App

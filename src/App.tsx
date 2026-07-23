import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppNav } from './components/AppNav'
import { ItemDetailPanel } from './components/ItemDetailPanel'
import { LoadingState } from './components/LoadingState'
import { LoginPage } from './components/LoginPage'
import { UrgentCasesModal } from './components/UrgentCasesModal'
import { ItsmTokenModal } from './components/ItsmTokenModal'
import { DashboardPage } from './pages/DashboardPage'
import { ReportingPage } from './pages/ReportingPage'
import {
  getSessionUsername,
  getSessionIsAdmin,
  logout,
  verifySession,
} from './services/authService'
import { fetchItsmItems } from './services/itsmService'
import { fetchItsmCredentialsStatus } from './services/itsmCredentialsService'
import {
  ItsmTokenRequiredError,
  registerItsmTokenRequestHandler,
} from './services/itsmApiClient'
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
import { filterUrgentItems } from './utils/urgentCases'
import { useAppRoute } from './hooks/useAppRoute'
import { useIdleTimeout } from './hooks/useIdleTimeout'
import { useBackgroundRefresh } from './hooks/useBackgroundRefresh'
import { useDeliveryDates } from './hooks/useDeliveryDates'
import { useSharedUrgentCases } from './hooks/useSharedUrgentCases'
import { clearDeliveryDatesCache } from './services/deliveryDatesService'
import './App.css'

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: 'all',
  itemType: 'all',
  group: 'all',
  state: 'all',
  responsible: 'all',
}

function App() {
  const { route, navigate } = useAppRoute()
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [itsmTokenModalOpen, setItsmTokenModalOpen] = useState(false)
  const [itsmTokenMessage, setItsmTokenMessage] = useState<string | null>(null)

  const username = getSessionUsername()

  const {
    urgentIds,
    updatedBy: urgentUpdatedBy,
    updatedAt: urgentUpdatedAt,
    connected: urgentRealtimeConnected,
    realtimeEnabled: urgentRealtimeEnabled,
    connectionError: urgentConnectionError,
    updateUrgentIds,
  } = useSharedUrgentCases(username, authenticated)

  const applyFetchResult = useCallback((result: FetchResult) => {
    setItems(result.items)
    setTotalItems(result.totalItems)
    setFetchedAt(result.fetchedAt)
    setSelectedItem((current) => {
      if (!current) return null
      return result.items.find((item) => item.id === current.id) ?? current
    })
  }, [])

  const openItsmTokenModal = useCallback((message?: string) => {
    setItsmTokenMessage(message ?? null)
    setItsmTokenModalOpen(true)
    setLoading(false)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchItsmItems()
      applyFetchResult(result)
    } catch (err) {
      if (err instanceof ItsmTokenRequiredError) {
        openItsmTokenModal(err.message)
        return
      }
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setItems([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }, [applyFetchResult, openItsmTokenModal])

  const refreshDataInBackground = useCallback(async () => {
    try {
      const result = await fetchItsmItems()
      applyFetchResult(result)
    } catch {
      // Mantener los datos actuales si el refresco en segundo plano falla.
    }
  }, [applyFetchResult])

  useEffect(() => {
    registerItsmTokenRequestHandler((message) => {
      openItsmTokenModal(message)
    })

    return () => registerItsmTokenRequestHandler(null)
  }, [openItsmTokenModal])

  useEffect(() => {
    void verifySession().then((valid) => {
      setAuthenticated(valid)
      setIsAdmin(valid && getSessionIsAdmin())
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    if (!authenticated) return

    void fetchItsmCredentialsStatus()
      .then((status) => {
        if (!status.configured) {
          openItsmTokenModal('Configura el token ITSM para cargar los tickets.')
        }
      })
      .catch(() => {
        openItsmTokenModal('Configura el token ITSM para cargar los tickets.')
      })
  }, [authenticated, openItsmTokenModal])

  useEffect(() => {
    if (!authenticated || itsmTokenModalOpen) return
    void loadData()
  }, [authenticated, itsmTokenModalOpen, loadData])

  useBackgroundRefresh(
    refreshDataInBackground,
    authenticated && !loading && items.length > 0,
  )

  const filteredItems = useMemo(
    () => filterItems(items, filters),
    [items, filters],
  )

  const urgentItems = useMemo(
    () => filterUrgentItems(items, urgentIds),
    [items, urgentIds],
  )

  const itemsForDeliveryDates = useMemo(() => {
    const byId = new Map<number, IncidentItem>()

    for (const item of filteredItems) {
      byId.set(item.id, item)
    }

    for (const item of urgentItems) {
      byId.set(item.id, item)
    }

    if (selectedItem) {
      byId.set(selectedItem.id, selectedItem)
    }

    return Array.from(byId.values())
  }, [filteredItems, urgentItems, selectedItem])

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

  const urgentCount = urgentItems.length

  const handleUrgentIdsChange = useCallback(
    async (ids: string[]) => {
      await updateUrgentIds(ids)
    },
    [updateUrgentIds],
  )

  const handleMatrixSelect = useCallback((selection: MatrixSelection) => {
    setFilters((current) => {
      const active = filtersToMatrixSelection(current)
      if (isMatrixSelectionActive(active, selection)) {
        return clearMatrixSelectionFromFilters(current, selection)
      }
      return applyMatrixSelectionToFilters(current, selection)
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
      <AppNav
        route={route}
        onNavigate={navigate}
        username={username}
        isAdmin={isAdmin}
        loading={loading}
        urgentCount={urgentCount}
        onLogout={handleLogout}
        onRefresh={() => void loadData()}
        onOpenUrgent={() => setUrgentModalOpen(true)}
      />

      {route === 'dashboard' ? (
        <DashboardPage
          loading={loading}
          error={error}
          fetchedAt={fetchedAt}
          totalItems={totalItems}
          summary={summary}
          filters={filters}
          itemTypes={itemTypes}
          groups={groups}
          states={states}
          responsibles={responsibles}
          filteredItems={filteredItems}
          items={items}
          customField={customField}
          chartType={chartType}
          customGrouped={customGrouped}
          responsibleStateMatrix={responsibleStateMatrix}
          matrixSelection={matrixSelection}
          deliveryDatesById={deliveryDatesById}
          deliveryDatesLoading={deliveryDatesLoading}
          onFiltersChange={setFilters}
          onFiltersReset={() => setFilters(DEFAULT_FILTERS)}
          onCustomFieldChange={setCustomField}
          onChartTypeChange={setChartType}
          onMatrixSelect={handleMatrixSelect}
          onSelectItem={setSelectedItem}
        />
      ) : (
        <ReportingPage
          items={items}
          fetchedAt={fetchedAt}
          loading={loading}
          error={error}
        />
      )}

      <UrgentCasesModal
        open={urgentModalOpen}
        items={items}
        urgentIds={urgentIds}
        fetchedAt={fetchedAt}
        onUrgentIdsChange={handleUrgentIdsChange}
        connected={urgentRealtimeConnected}
        realtimeEnabled={urgentRealtimeEnabled}
        connectionError={urgentConnectionError}
        updatedBy={urgentUpdatedBy}
        updatedAt={urgentUpdatedAt}
        deliveryDatesById={deliveryDatesById}
        deliveryDatesLoading={deliveryDatesLoading}
        onClose={() => setUrgentModalOpen(false)}
        onSelect={setSelectedItem}
      />

      <ItsmTokenModal
        open={itsmTokenModalOpen}
        message={itsmTokenMessage}
        onSaved={async () => {
          setItsmTokenModalOpen(false)
          setItsmTokenMessage(null)
          await loadData()
        }}
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

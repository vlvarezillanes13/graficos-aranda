import type { FilterState } from '../utils/aggregations'
import {
  filtersToMatrixSelection,
  getMatrixSelectionLabel,
} from '../utils/aggregations'

interface FilterBarProps {
  filters: FilterState
  itemTypes: string[]
  groups: string[]
  states: string[]
  responsibles: string[]
  resultCount: number
  totalCount: number
  onChange: (filters: FilterState) => void
  onReset: () => void
}

const STATUS_LABELS: Record<FilterState['status'], string> = {
  all: 'Todos',
  open: 'Abiertos',
  closed: 'Cerrados',
}

export function FilterBar({
  filters,
  itemTypes,
  groups,
  states,
  responsibles,
  resultCount,
  totalCount,
  onChange,
  onReset,
}: FilterBarProps) {
  const update = (partial: Partial<FilterState>) =>
    onChange({ ...filters, ...partial })

  const matrixSelection = filtersToMatrixSelection(filters)

  const activeChips: Array<{ key: string; label: string; onClear: () => void }> =
    []

  if (filters.search.trim()) {
    activeChips.push({
      key: 'search',
      label: `Buscar: ${filters.search.trim()}`,
      onClear: () => update({ search: '' }),
    })
  }

  if (filters.status !== 'all') {
    activeChips.push({
      key: 'status',
      label: `Estado ticket: ${STATUS_LABELS[filters.status]}`,
      onClear: () => update({ status: 'all' }),
    })
  }

  if (filters.itemType !== 'all') {
    activeChips.push({
      key: 'itemType',
      label: `Tipo: ${filters.itemType}`,
      onClear: () => update({ itemType: 'all' }),
    })
  }

  if (filters.group !== 'all') {
    activeChips.push({
      key: 'group',
      label: `Grupo: ${filters.group}`,
      onClear: () => update({ group: 'all' }),
    })
  }

  if (filters.responsible !== 'all') {
    activeChips.push({
      key: 'responsible',
      label: `Responsable: ${filters.responsible}`,
      onClear: () => update({ responsible: 'all' }),
    })
  }

  if (filters.state !== 'all') {
    activeChips.push({
      key: 'state',
      label: `Estado workflow: ${filters.state}`,
      onClear: () => update({ state: 'all' }),
    })
  }

  return (
    <section id="filter-bar-section" className="filter-bar">
      <div className="filter-bar-header">
        <div>
          <h2>Filtros interactivos</h2>
          <p>
            Mostrando <strong>{resultCount}</strong> de{' '}
            <strong>{totalCount}</strong> registros
            {matrixSelection && (
              <>
                {' '}
                · Matriz: <strong>{getMatrixSelectionLabel(matrixSelection)}</strong>
              </>
            )}
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={onReset}>
          Limpiar filtros
        </button>
      </div>

      <div className="filter-grid">
        <label className="filter-field search-field">
          <span>Buscar</span>
          <input
            type="search"
            placeholder="ID, asunto, responsable..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </label>

        <label className="filter-field">
          <span>Estado ticket</span>
          <select
            value={filters.status}
            onChange={(e) =>
              update({ status: e.target.value as FilterState['status'] })
            }
          >
            <option value="all">Todos</option>
            <option value="open">Abiertos</option>
            <option value="closed">Cerrados</option>
          </select>
        </label>

        <label className="filter-field">
          <span>Responsable</span>
          <select
            value={filters.responsible}
            onChange={(e) => update({ responsible: e.target.value })}
          >
            <option value="all">Todos</option>
            {responsibles.map((responsible) => (
              <option key={responsible} value={responsible}>
                {responsible}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Tipo</span>
          <select
            value={filters.itemType}
            onChange={(e) => update({ itemType: e.target.value })}
          >
            <option value="all">Todos</option>
            {itemTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Grupo</span>
          <select
            value={filters.group}
            onChange={(e) => update({ group: e.target.value })}
          >
            <option value="all">Todos</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Estado workflow</span>
          <select
            value={filters.state}
            onChange={(e) => update({ state: e.target.value })}
          >
            <option value="all">Todos</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeChips.length > 0 && (
        <div className="filter-active-chips">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="filter-chip"
              onClick={chip.onClear}
              title="Quitar filtro"
            >
              {chip.label} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

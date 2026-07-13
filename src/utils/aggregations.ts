import type { CountItem, GroupField, IncidentItem } from '../types/incident'

export const TRACKED_STATES = [
  'Open',
  'In Progress',
  'Resolved',
  'Pending Certification',
  'Suspended',
] as const

export type TrackedState = (typeof TRACKED_STATES)[number]

export interface DashboardSummary {
  total: number
  open: number
  closed: number
  byState: Record<TrackedState, number>
}

export interface FilterState {
  search: string
  status: 'all' | 'open' | 'closed'
  itemType: string
  group: string
  state: string
  responsible: string
}

export function groupByField(
  items: IncidentItem[],
  field: GroupField,
): CountItem[] {
  const counts = new Map<string, number>()

  for (const item of items) {
    const raw = item[field]
    const name =
      raw === null || raw === undefined || String(raw).trim() === ''
        ? 'Sin dato'
        : String(raw)

    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function getSummary(items: IncidentItem[]): DashboardSummary {
  const byState = Object.fromEntries(
    TRACKED_STATES.map((state) => [
      state,
      items.filter((item) => item.stateName === state).length,
    ]),
  ) as Record<TrackedState, number>

  return {
    total: items.length,
    open: items.filter((i) => !i.isClosed).length,
    closed: items.filter((i) => i.isClosed).length,
    byState,
  }
}

export function getUniqueValues(
  items: IncidentItem[],
  field: 'itemTypeName' | 'groupName' | 'stateName' | 'responsibleName',
): string[] {
  return [
    ...new Set(
      items
        .map((item) => {
          const value = item[field]
          if (field === 'responsibleName') {
            return value?.trim() || 'Sin responsable'
          }
          return value
        })
        .filter((value): value is string => Boolean(value?.trim())),
    ),
  ].sort()
}

export function filterItems(
  items: IncidentItem[],
  filters: FilterState,
): IncidentItem[] {
  const search = filters.search.trim().toLowerCase()

  return items.filter((item) => {
    if (filters.status === 'open' && item.isClosed) return false
    if (filters.status === 'closed' && !item.isClosed) return false
    if (filters.itemType !== 'all' && item.itemTypeName !== filters.itemType) {
      return false
    }
    if (filters.group !== 'all' && item.groupName !== filters.group) {
      return false
    }
    if (filters.state !== 'all' && item.stateName !== filters.state) {
      return false
    }
    if (filters.responsible !== 'all') {
      const responsible = item.responsibleName?.trim() || 'Sin responsable'
      if (responsible !== filters.responsible) return false
    }

    if (!search) return true

    return [
      item.idByProject,
      item.subject,
      item.responsibleName,
      item.groupName,
      item.stateName,
      item.customerName,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search))
  })
}

export function truncateLabel(label: string, max = 28): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 3)}...`
}

export function formatDate(timestamp: number | null): string {
  if (!timestamp) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export function getProgressTone(progress: number): string {
  if (progress >= 100) return 'complete'
  if (progress >= 75) return 'high'
  if (progress >= 50) return 'medium'
  if (progress >= 25) return 'low'
  return 'critical'
}

export interface ResponsibleStateRow {
  responsible: string
  counts: Record<string, number>
  total: number
}

export interface ResponsibleStateMatrix {
  states: string[]
  rows: ResponsibleStateRow[]
  totals: Record<string, number>
  grandTotal: number
}

export type MatrixSelection =
  | { type: 'cell'; responsible: string; state: string }
  | { type: 'row'; responsible: string }
  | { type: 'column'; state: string }

export function getMatrixSelectionLabel(selection: MatrixSelection): string {
  switch (selection.type) {
    case 'cell':
      return `${selection.responsible} · ${selection.state}`
    case 'row':
      return `Responsable: ${selection.responsible}`
    case 'column':
      return `Estado: ${selection.state}`
  }
}

export function filtersToMatrixSelection(
  filters: FilterState,
): MatrixSelection | null {
  const hasResponsible = filters.responsible !== 'all'
  const hasState = filters.state !== 'all'

  if (hasResponsible && hasState) {
    return {
      type: 'cell',
      responsible: filters.responsible,
      state: filters.state,
    }
  }

  if (hasResponsible) {
    return { type: 'row', responsible: filters.responsible }
  }

  if (hasState) {
    return { type: 'column', state: filters.state }
  }

  return null
}

export function applyMatrixSelectionToFilters(
  filters: FilterState,
  selection: MatrixSelection,
): FilterState {
  switch (selection.type) {
    case 'cell':
      return {
        ...filters,
        responsible: selection.responsible,
        state: selection.state,
      }
    case 'row':
      return {
        ...filters,
        responsible: selection.responsible,
        state: 'all',
      }
    case 'column':
      return {
        ...filters,
        state: selection.state,
        responsible: 'all',
      }
  }
}

export function clearMatrixSelectionFromFilters(
  filters: FilterState,
  selection: MatrixSelection,
): FilterState {
  switch (selection.type) {
    case 'cell':
      return { ...filters, responsible: 'all', state: 'all' }
    case 'row':
      return { ...filters, responsible: 'all' }
    case 'column':
      return { ...filters, state: 'all' }
  }
}

export function isMatrixSelectionActive(
  selection: MatrixSelection | null,
  candidate: MatrixSelection,
): boolean {
  if (!selection) return false

  if (selection.type !== candidate.type) return false

  switch (selection.type) {
    case 'cell':
      return (
        candidate.type === 'cell' &&
        selection.responsible === candidate.responsible &&
        selection.state === candidate.state
      )
    case 'row':
      return (
        candidate.type === 'row' &&
        selection.responsible === candidate.responsible
      )
    case 'column':
      return candidate.type === 'column' && selection.state === candidate.state
  }
}

export function buildResponsibleByStateMatrix(
  items: IncidentItem[],
): ResponsibleStateMatrix {
  const extraStates = new Set<string>()
  const matrix = new Map<string, Map<string, number>>()

  for (const item of items) {
    const responsible = item.responsibleName?.trim() || 'Sin responsable'
    const state = item.stateName?.trim() || 'Sin estado'

    if (!TRACKED_STATES.includes(state as TrackedState)) {
      extraStates.add(state)
    }

    if (!matrix.has(responsible)) {
      matrix.set(responsible, new Map())
    }

    const row = matrix.get(responsible)!
    row.set(state, (row.get(state) ?? 0) + 1)
  }

  const states = [...TRACKED_STATES, ...Array.from(extraStates).sort()]

  const rows = Array.from(matrix.entries())
    .map(([responsible, countsMap]) => {
      const counts = Object.fromEntries(
        states.map((state) => [state, countsMap.get(state) ?? 0]),
      ) as Record<string, number>

      return {
        responsible,
        counts,
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      }
    })
    .sort((a, b) => b.total - a.total)

  const totals = Object.fromEntries(
    states.map((state) => [
      state,
      rows.reduce((sum, row) => sum + row.counts[state], 0),
    ]),
  ) as Record<string, number>

  return {
    states,
    rows,
    totals,
    grandTotal: rows.reduce((sum, row) => sum + row.total, 0),
  }
}

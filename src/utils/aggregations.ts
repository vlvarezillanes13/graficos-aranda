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
  field: 'itemTypeName' | 'groupName' | 'stateName',
): string[] {
  return [
    ...new Set(
      items
        .map((item) => item[field])
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

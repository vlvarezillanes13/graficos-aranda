import type { HistoryDetail, HistoryEntry } from '../types/itemHistory'
import { getHistoryDetails } from './itemHistory'

export interface HistoryTransition {
  timestamp: number
  entry: HistoryEntry
  detail: HistoryDetail
}

const GROUP_FIELD_PATTERN = /grupo|group|assignment|resolutor|asignaci/i
const STATE_FIELD_PATTERN = /estado|state|status/i

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function matchesTarget(value: string | null | undefined, target: string): boolean {
  return normalizeText(value).localeCompare(target, undefined, {
    sensitivity: 'accent',
  }) === 0
}

function isGroupField(fieldName: string): boolean {
  return GROUP_FIELD_PATTERN.test(fieldName)
}

function isStateField(fieldName: string): boolean {
  return STATE_FIELD_PATTERN.test(fieldName)
}

function isTransitionToValue(
  detail: HistoryDetail,
  target: string,
): boolean {
  if (!matchesTarget(detail.newValue, target)) return false
  if (matchesTarget(detail.oldValue, target)) return false
  return true
}

function isTransitionToGroup(
  detail: HistoryDetail,
  groupName: string,
): boolean {
  if (!isGroupField(detail.fieldName)) return false
  return isTransitionToValue(detail, groupName)
}

function isTransitionToState(
  detail: HistoryDetail,
  stateName: string,
): boolean {
  if (!isStateField(detail.fieldName)) return false
  return isTransitionToValue(detail, stateName)
}

function pickEarliestTransition(
  candidates: HistoryTransition[],
): HistoryTransition | null {
  if (candidates.length === 0) return null

  return candidates.reduce((earliest, candidate) => {
    if (candidate.timestamp < earliest.timestamp) return candidate
    if (
      candidate.timestamp === earliest.timestamp &&
      candidate.entry.id < earliest.entry.id
    ) {
      return candidate
    }
    return earliest
  })
}

function collectGroupTransitions(
  entries: HistoryEntry[],
  groupName: string,
): HistoryTransition[] {
  const transitions: HistoryTransition[] = []

  for (const entry of entries) {
    for (const detail of getHistoryDetails(entry)) {
      if (!isTransitionToGroup(detail, groupName)) continue
      transitions.push({ timestamp: entry.created, entry, detail })
    }
  }

  return transitions
}

function displayHistoryValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'

  return normalizeText(
    value
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"'),
  )
}

export function formatHistoryTransitionValue(
  value: string | null | undefined,
): string {
  return displayHistoryValue(value)
}

function sortTransitionsChronologically(
  transitions: HistoryTransition[],
): HistoryTransition[] {
  return [...transitions].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    return a.entry.id - b.entry.id
  })
}

export function collectAllStateTransitions(
  entries: HistoryEntry[],
): HistoryTransition[] {
  const transitions: HistoryTransition[] = []

  for (const entry of entries) {
    for (const detail of getHistoryDetails(entry)) {
      if (!isStateField(detail.fieldName)) continue

      const newValue = normalizeText(detail.newValue)
      const oldValue = normalizeText(detail.oldValue)
      if (!newValue) continue
      if (newValue === oldValue) continue

      transitions.push({ timestamp: entry.created, entry, detail })
    }
  }

  return sortTransitionsChronologically(transitions)
}

function collectStateTransitions(
  entries: HistoryEntry[],
  stateName: string,
): HistoryTransition[] {
  const transitions: HistoryTransition[] = []

  for (const entry of entries) {
    for (const detail of getHistoryDetails(entry)) {
      if (!isTransitionToState(detail, stateName)) continue
      transitions.push({ timestamp: entry.created, entry, detail })
    }
  }

  return transitions
}

export function findEarliestGroupTransition(
  entries: HistoryEntry[],
  groupName: string,
): HistoryTransition | null {
  return pickEarliestTransition(collectGroupTransitions(entries, groupName))
}

export function findFirstGroupTransition(
  entries: HistoryEntry[],
  groupName: string,
): HistoryTransition | null {
  return findEarliestGroupTransition(entries, groupName)
}

export function findEarliestStateTransition(
  entries: HistoryEntry[],
  stateName: string,
): HistoryTransition | null {
  return pickEarliestTransition(collectStateTransitions(entries, stateName))
}

export function findFirstStateTransition(
  entries: HistoryEntry[],
  stateName: string,
): HistoryTransition | null {
  return findEarliestStateTransition(entries, stateName)
}

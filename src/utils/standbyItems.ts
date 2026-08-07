import type { IncidentItem } from '../types/incident'

/** Matches category labels like "Standby", "Stand by", "STAND-BY". */
const STANDBY_PATTERN = /stand[\s_-]*by/i

function categoryText(item: IncidentItem): string {
  return `${item.categoryName ?? ''} ${item.categoryHierarchy ?? ''}`
}

export function isStandbyItem(item: IncidentItem): boolean {
  return STANDBY_PATTERN.test(categoryText(item))
}

export function partitionStandbyItems(items: IncidentItem[]): {
  operationalItems: IncidentItem[]
  standbyItems: IncidentItem[]
} {
  const operationalItems: IncidentItem[] = []
  const standbyItems: IncidentItem[] = []

  for (const item of items) {
    if (isStandbyItem(item)) {
      standbyItems.push(item)
    } else {
      operationalItems.push(item)
    }
  }

  return { operationalItems, standbyItems }
}

import type { ItemDeliveryDates } from '../types/additionalField'
import type { IncidentItem } from '../types/incident'
import { formatDate } from './aggregations'

export function formatDeliveryDate(
  item: IncidentItem,
  datesById?: Map<number, ItemDeliveryDates>,
): string {
  return formatDate(datesById?.get(item.id)?.deliveryDate ?? null)
}

export function formatDeliveryTestDate(
  item: IncidentItem,
  datesById?: Map<number, ItemDeliveryDates>,
): string {
  return formatDate(datesById?.get(item.id)?.deliveryTestDate ?? null)
}

export function formatPendingAfpDate(
  item: IncidentItem,
  datesById?: Map<number, ItemDeliveryDates>,
): string {
  return formatDate(datesById?.get(item.id)?.pendingAfpDate ?? null)
}

export function getDeliveryDateTimestamp(
  item: IncidentItem,
  datesById?: Map<number, ItemDeliveryDates>,
): number | null {
  return datesById?.get(item.id)?.deliveryDate ?? null
}

export function getDeliveryTestTimestamp(
  item: IncidentItem,
  datesById?: Map<number, ItemDeliveryDates>,
): number | null {
  return datesById?.get(item.id)?.deliveryTestDate ?? null
}

export function getPendingAfpTimestamp(
  item: IncidentItem,
  datesById?: Map<number, ItemDeliveryDates>,
): number | null {
  return datesById?.get(item.id)?.pendingAfpDate ?? null
}

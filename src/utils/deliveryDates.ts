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

export function formatUltimaIteracionDate(
  item: IncidentItem,
  datesById?: Map<number, ItemDeliveryDates>,
): string {
  return formatDate(datesById?.get(item.id)?.ultimaIteracion ?? null)
}

export function formatTestAprobadoDate(
  item: IncidentItem,
  datesById?: Map<number, ItemDeliveryDates>,
): string {
  return formatDate(datesById?.get(item.id)?.testAprobado ?? null)
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

export function getUltimaIteracionTimestamp(
  item: IncidentItem,
  datesById?: Map<number, ItemDeliveryDates>,
): number | null {
  return datesById?.get(item.id)?.ultimaIteracion ?? null
}

export function getTestAprobadoTimestamp(
  item: IncidentItem,
  datesById?: Map<number, ItemDeliveryDates>,
): number | null {
  return datesById?.get(item.id)?.testAprobado ?? null
}

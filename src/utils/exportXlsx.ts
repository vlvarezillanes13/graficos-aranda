import * as XLSX from 'xlsx'
import type { ItemDeliveryDates } from '../types/additionalField'
import type { IncidentItem } from '../types/incident'
import { formatDate } from './aggregations'
import {
  formatDeliveryDate,
  formatDeliveryTestDate,
  formatUltimaIteracionDate,
} from './deliveryDates'

const DATE_FIELDS = new Set([
  'closedDate',
  'expectedDate',
  'finalDate',
  'initialDate',
  'modifiedDate',
  'openedDate',
  'realDate',
])

function formatExportValue(
  key: string,
  value: IncidentItem[keyof IncidentItem],
): string | number | boolean | null {
  if (value === null || value === undefined) return null

  if (DATE_FIELDS.has(key) && typeof value === 'number') {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No'
  }

  return value as string | number
}

function itemToRow(
  item: IncidentItem,
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
): Record<string, string | number | boolean | null> {
  const row = Object.fromEntries(
    (Object.keys(item) as (keyof IncidentItem)[]).map((key) => [
      key,
      formatExportValue(key, item[key]),
    ]),
  )

  return {
    estadoTicket: item.isClosed ? 'Cerrado' : 'Abierto',
    'Fecha de Entrega': formatDeliveryDate(item, deliveryDatesById),
    'Fecha Entrega TEST': formatDeliveryTestDate(item, deliveryDatesById),
    'Fecha Ultima Iteración': formatUltimaIteracionDate(item, deliveryDatesById),
    ...row,
  }
}

function createWorksheet(
  items: IncidentItem[],
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
) {
  return XLSX.utils.json_to_sheet(
    items.map((item) => itemToRow(item, deliveryDatesById)),
  )
}

function itemToGridRow(
  item: IncidentItem,
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
) {
  return {
    ID: item.idByProject,
    Asunto: item.subject,
    Tipo: item.itemTypeName,
    Grupo: item.groupName,
    Responsable: item.responsibleName,
    Estado: item.stateName,
    Prioridad: item.priorityName,
    Apertura: formatDate(item.openedDate),
    'Fecha de Entrega': formatDeliveryDate(item, deliveryDatesById),
    'Fecha Entrega TEST': formatDeliveryTestDate(item, deliveryDatesById),
    'Fecha Ultima Iteración': formatUltimaIteracionDate(item, deliveryDatesById),
  }
}

function createGridWorksheet(
  items: IncidentItem[],
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
) {
  return XLSX.utils.json_to_sheet(
    items.map((item) => itemToGridRow(item, deliveryDatesById)),
  )
}

export function downloadIncidentsXlsx(
  items: IncidentItem[],
  fetchedAt?: Date | null,
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
): void {
  if (items.length === 0) return

  const openItems = items.filter((item) => !item.isClosed)
  const closedItems = items.filter((item) => item.isClosed)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    createWorksheet(items, deliveryDatesById),
    'Todos',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    createWorksheet(openItems, deliveryDatesById),
    'Abiertos',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    createWorksheet(closedItems, deliveryDatesById),
    'Cerrados',
  )

  const dateStamp = (fetchedAt ?? new Date()).toISOString().slice(0, 10)
  XLSX.writeFile(
    workbook,
    `itsm-incidentes-abiertos-cerrados-${dateStamp}.xlsx`,
  )
}

export function getExportCounts(items: IncidentItem[]) {
  const closed = items.filter((item) => item.isClosed).length
  return {
    total: items.length,
    open: items.length - closed,
    closed,
  }
}

export function downloadUrgentCasesXlsx(
  items: IncidentItem[],
  fetchedAt?: Date | null,
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
): void {
  if (items.length === 0) return

  const sortedItems = [...items].sort(
    (a, b) => b.openedDate - a.openedDate,
  )
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    createGridWorksheet(sortedItems, deliveryDatesById),
    'Urgentes',
  )

  const dateStamp = (fetchedAt ?? new Date()).toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `itsm-casos-urgentes-${dateStamp}.xlsx`)
}

import * as XLSX from 'xlsx'
import type { IncidentItem } from '../types/incident'

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
): Record<string, string | number | boolean | null> {
  const row = Object.fromEntries(
    (Object.keys(item) as (keyof IncidentItem)[]).map((key) => [
      key,
      formatExportValue(key, item[key]),
    ]),
  )

  return {
    estadoTicket: item.isClosed ? 'Cerrado' : 'Abierto',
    ...row,
  }
}

function createWorksheet(items: IncidentItem[]) {
  return XLSX.utils.json_to_sheet(items.map(itemToRow))
}

export function downloadIncidentsXlsx(
  items: IncidentItem[],
  fetchedAt?: Date | null,
): void {
  if (items.length === 0) return

  const openItems = items.filter((item) => !item.isClosed)
  const closedItems = items.filter((item) => item.isClosed)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, createWorksheet(items), 'Todos')
  XLSX.utils.book_append_sheet(workbook, createWorksheet(openItems), 'Abiertos')
  XLSX.utils.book_append_sheet(workbook, createWorksheet(closedItems), 'Cerrados')

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

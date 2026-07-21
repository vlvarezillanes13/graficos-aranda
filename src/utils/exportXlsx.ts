import * as XLSX from 'xlsx'
import type { ItemDeliveryDates } from '../types/additionalField'
import type { IncidentItem } from '../types/incident'
import {
  formatDeliveryDate,
  formatDeliveryTestDate,
  formatTestAprobadoDate,
  formatUltimaIteracionDate,
} from './deliveryDates'

type ExportRow = Record<string, string>

function itemToExportRow(
  item: IncidentItem,
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
): ExportRow {
  return {
    'ESTADO GENERAL': item.isClosed ? 'Cerrado' : 'Abierto',
    GRUPO: item.groupName,
    'N° TICKET': item.idByProject,
    ASUNTO: item.subject,
    DESCRIPCION: item.descriptionNoHtml.trim(),
    ESTADO: item.stateName,
    RESPONSABLE: item.responsibleName,
    IMPACTO: item.impactName,
    URGENCIA: item.urgencyName,
    PRIORIDAD: item.priorityName,
    CATEGORIA: item.categoryHierarchy,
    'SUB-CATEGORIA': item.categoryName,
    'FECHA DE ENTREGA': formatDeliveryDate(item, deliveryDatesById),
    'FECHA ENTREGA TEST': formatDeliveryTestDate(item, deliveryDatesById),
    'FECHA GESTIÓN AFC': formatUltimaIteracionDate(item, deliveryDatesById),
    'FECHA TEST APROBADO': formatTestAprobadoDate(item, deliveryDatesById),
  }
}

function createExportWorksheet(
  items: IncidentItem[],
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
) {
  return XLSX.utils.json_to_sheet(
    items.map((item) => itemToExportRow(item, deliveryDatesById)),
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
    createExportWorksheet(items, deliveryDatesById),
    'Todos',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    createExportWorksheet(openItems, deliveryDatesById),
    'Abiertos',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    createExportWorksheet(closedItems, deliveryDatesById),
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
    createExportWorksheet(sortedItems, deliveryDatesById),
    'Urgentes',
  )

  const dateStamp = (fetchedAt ?? new Date()).toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `itsm-casos-urgentes-${dateStamp}.xlsx`)
}

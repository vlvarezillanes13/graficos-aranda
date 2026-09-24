import type { WorkSheet } from 'xlsx'
import { CHILEAN_HOLIDAY_RANGE } from '../config/chileanHolidays'
import type { ItemDeliveryDates } from '../types/additionalField'
import type { IncidentItem } from '../types/incident'
import {
  buildSpanishTextDateFormula,
  columnIndexToLetter,
  createHolidaysWorksheet,
  EMPTY_DATE_PLACEHOLDER,
  EXCEL_DATE_TIME_FORMAT,
  formatSpanishExportDate,
} from './excelDates'

type ExportCell = string | number | null
type ExportRow = Record<string, ExportCell>
type XlsxModule = typeof import('xlsx')

const ESTADO_HEADER = 'ESTADO'
const FECHA_APERTURA_HEADER = 'FECHA DE APERTURA'
const FECHA_ENTREGA_HEADER = 'FECHA DE ENTREGA'
const DIAS_RESUELTOS_HEADER = 'DIAS RESUELTOS'
const DIAS_RESUELTOS_FORMAT = '0'
const SIN_FECHA_DE_ENTREGA = 'SIN FECHA DE ENTREGA'

const EXPORT_HEADERS = [
  'ESTADO GENERAL',
  'GRUPO',
  'N° TICKET',
  'ASUNTO',
  'DESCRIPCION',
  ESTADO_HEADER,
  'RESPONSABLE',
  'IMPACTO',
  'URGENCIA',
  'URGENTES',
  'ESTABILIZACION',
  'PRIORIDAD',
  'CATEGORIA',
  'SUB-CATEGORIA',
  FECHA_APERTURA_HEADER,
  FECHA_ENTREGA_HEADER,
  'FECHA ENTREGA TEST',
  'FECHA GESTIÓN AFC',
  'FECHA TEST APROBADO',
  'FECHA PENDIENTE SUSPENDIDO',
  DIAS_RESUELTOS_HEADER,
] as const

const DATE_HEADERS = new Set<string>([
  FECHA_APERTURA_HEADER,
  FECHA_ENTREGA_HEADER,
  'FECHA ENTREGA TEST',
  'FECHA GESTIÓN AFC',
  'FECHA TEST APROBADO',
  'FECHA PENDIENTE SUSPENDIDO',
])

function loadXlsx() {
  return import('xlsx')
}

function buildIdSet(ids?: string[]): Set<string> {
  return new Set(
    (ids ?? [])
      .map((id) => id.trim().toUpperCase())
      .filter(Boolean),
  )
}

function isResolvedState(stateName: string | null | undefined): boolean {
  const normalized = (stateName ?? '').trim().toLocaleLowerCase('es-CL')
  return normalized === 'resolved' || normalized === 'resuelto'
}

function getFechaEntregaValue(
  item: IncidentItem,
  deliveryDate: number | null | undefined,
): ExportCell {
  if (deliveryDate != null) return formatSpanishExportDate(deliveryDate)
  if (isResolvedState(item.stateName)) return SIN_FECHA_DE_ENTREGA
  return formatSpanishExportDate(null)
}

function excelCellRef(column: number, excelRow: number): string {
  return `${columnIndexToLetter(column)}${excelRow}`
}

function invalidExcelDateCheck(ref: string): string {
  return `OR(ISBLANK(${ref}),NOT(ISNUMBER(${ref})),${ref}<=0)`
}

function itemToExportRow(
  item: IncidentItem,
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
  urgentIdSet?: Set<string>,
  stabilizationIdSet?: Set<string>,
): ExportRow {
  const ticketId = item.idByProject.trim().toUpperCase()
  const isUrgent = urgentIdSet?.has(ticketId) ?? false
  const isStabilization = stabilizationIdSet?.has(ticketId) ?? false
  const deliveryDates = deliveryDatesById?.get(item.id)

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
    URGENTES: isUrgent ? 'Sí' : 'No',
    ESTABILIZACION: isStabilization ? 'Sí' : 'No',
    PRIORIDAD: item.priorityName,
    CATEGORIA: item.categoryHierarchy,
    'SUB-CATEGORIA': item.categoryName,
    [FECHA_APERTURA_HEADER]: formatSpanishExportDate(item.openedDate),
    [FECHA_ENTREGA_HEADER]: getFechaEntregaValue(
      item,
      deliveryDates?.deliveryDate,
    ),
    'FECHA ENTREGA TEST': formatSpanishExportDate(
      deliveryDates?.deliveryTestDate,
    ),
    'FECHA GESTIÓN AFC': formatSpanishExportDate(
      deliveryDates?.ultimaIteracion,
    ),
    'FECHA TEST APROBADO': formatSpanishExportDate(
      deliveryDates?.testAprobado,
    ),
    'FECHA PENDIENTE SUSPENDIDO': formatSpanishExportDate(
      deliveryDates?.pendienteSuspendido,
    ),
    [DIAS_RESUELTOS_HEADER]: '',
  }
}

function getHeaderIndex(headers: string[], name: string): number {
  return headers.indexOf(name)
}

function readHeaderRow(XLSX: XlsxModule, worksheet: WorkSheet): string[] {
  if (!worksheet['!ref']) return []

  const range = XLSX.utils.decode_range(worksheet['!ref'])
  const headers: string[] = []

  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: column })]
    headers.push(cell?.v == null ? '' : String(cell.v))
  }

  return headers
}

function buildDiasResueltosFormula(
  excelRow: number,
  entregaCol: number,
  estadoCol: number,
) {
  const entregaRef = excelCellRef(entregaCol, excelRow)
  const estadoRef = excelCellRef(estadoCol, excelRow)
  const isResolved =
    `OR(LOWER(TRIM(${estadoRef}))="resolved",` +
    `LOWER(TRIM(${estadoRef}))="resuelto")`
  const missingEntrega = invalidExcelDateCheck(entregaRef)

  return (
    `IF(${isResolved},` +
    `IF(${missingEntrega},"${SIN_FECHA_DE_ENTREGA}",` +
    `IFERROR(NETWORKDAYS(${entregaRef},TODAY(),${CHILEAN_HOLIDAY_RANGE}),"${SIN_FECHA_DE_ENTREGA}")),` +
    `"")`
  )
}

function applyDateFormatsAndDiasResueltos(
  XLSX: XlsxModule,
  worksheet: WorkSheet,
): void {
  if (!worksheet['!ref']) return

  const range = XLSX.utils.decode_range(worksheet['!ref'])
  const headers = readHeaderRow(XLSX, worksheet)
  const dateColumns = headers
    .map((header, index) => (DATE_HEADERS.has(header) ? index : -1))
    .filter((index) => index >= 0)
  const entregaCol = getHeaderIndex(headers, FECHA_ENTREGA_HEADER)
  const estadoCol = getHeaderIndex(headers, ESTADO_HEADER)
  const diasCol = getHeaderIndex(headers, DIAS_RESUELTOS_HEADER)

  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    for (const column of dateColumns) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: column })
      const cell = worksheet[cellRef]
      if (!cell || typeof cell.v !== 'string') continue
      if (
        cell.v === SIN_FECHA_DE_ENTREGA ||
        cell.v === EMPTY_DATE_PLACEHOLDER ||
        !cell.v.trim()
      ) {
        continue
      }

      worksheet[cellRef] = {
        t: 'n',
        f: buildSpanishTextDateFormula(cell.v),
        z: EXCEL_DATE_TIME_FORMAT,
      }
    }

    if (diasCol < 0 || entregaCol < 0 || estadoCol < 0) {
      continue
    }

    worksheet[XLSX.utils.encode_cell({ r: row, c: diasCol })] = {
      t: 'n',
      f: buildDiasResueltosFormula(row + 1, entregaCol, estadoCol),
      z: DIAS_RESUELTOS_FORMAT,
    }
  }
}

function applyColumnWidths(worksheet: WorkSheet): void {
  const widths = [
    16, 22, 14, 36, 48, 18, 22, 14, 14, 12, 16, 14, 28, 22, 22, 26, 22, 22, 22,
    26, 18,
  ]

  worksheet['!cols'] = EXPORT_HEADERS.map((_, index) => ({
    wch: widths[index] ?? 18,
  }))
}

function createExportWorksheet(
  XLSX: XlsxModule,
  items: IncidentItem[],
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
  urgentIds?: string[],
  stabilizationIds?: string[],
) {
  const urgentIdSet = buildIdSet(urgentIds)
  const stabilizationIdSet = buildIdSet(stabilizationIds)
  const worksheet =
    items.length === 0
      ? XLSX.utils.aoa_to_sheet([[...EXPORT_HEADERS]])
      : XLSX.utils.json_to_sheet(
          items.map((item) =>
            itemToExportRow(
              item,
              deliveryDatesById,
              urgentIdSet,
              stabilizationIdSet,
            ),
          ),
          { header: [...EXPORT_HEADERS] },
        )

  applyDateFormatsAndDiasResueltos(XLSX, worksheet)
  applyColumnWidths(worksheet)

  return worksheet
}

function appendHolidaysSheet(XLSX: XlsxModule, workbook: ReturnType<XlsxModule['utils']['book_new']>) {
  XLSX.utils.book_append_sheet(
    workbook,
    createHolidaysWorksheet(XLSX),
    'Feriados',
  )
}

export async function downloadIncidentsXlsx(
  items: IncidentItem[],
  fetchedAt?: Date | null,
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
  urgentIds?: string[],
  stabilizationIds?: string[],
): Promise<void> {
  if (items.length === 0) return

  const XLSX = await loadXlsx()
  const openItems = items.filter((item) => !item.isClosed)
  const closedItems = items.filter((item) => item.isClosed)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    createExportWorksheet(
      XLSX,
      items,
      deliveryDatesById,
      urgentIds,
      stabilizationIds,
    ),
    'Todos',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    createExportWorksheet(
      XLSX,
      openItems,
      deliveryDatesById,
      urgentIds,
      stabilizationIds,
    ),
    'Abiertos',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    createExportWorksheet(
      XLSX,
      closedItems,
      deliveryDatesById,
      urgentIds,
      stabilizationIds,
    ),
    'Cerrados',
  )
  appendHolidaysSheet(XLSX, workbook)

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

export async function downloadUrgentCasesXlsx(
  items: IncidentItem[],
  fetchedAt?: Date | null,
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
  urgentIds?: string[],
): Promise<void> {
  if (items.length === 0) return

  const XLSX = await loadXlsx()
  const sortedItems = [...items].sort(
    (a, b) => b.openedDate - a.openedDate,
  )
  const workbook = XLSX.utils.book_new()
  const idsForExport =
    urgentIds ?? sortedItems.map((item) => item.idByProject)

  XLSX.utils.book_append_sheet(
    workbook,
    createExportWorksheet(XLSX, sortedItems, deliveryDatesById, idsForExport),
    'Urgentes',
  )
  appendHolidaysSheet(XLSX, workbook)

  const dateStamp = (fetchedAt ?? new Date()).toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `itsm-casos-urgentes-${dateStamp}.xlsx`)
}

export async function downloadStabilizationCasesXlsx(
  items: IncidentItem[],
  fetchedAt?: Date | null,
  deliveryDatesById?: Map<number, ItemDeliveryDates>,
  stabilizationIds?: string[],
): Promise<void> {
  if (items.length === 0) return

  const XLSX = await loadXlsx()
  const sortedItems = [...items].sort(
    (a, b) => b.openedDate - a.openedDate,
  )
  const workbook = XLSX.utils.book_new()
  const idsForExport =
    stabilizationIds ?? sortedItems.map((item) => item.idByProject)

  XLSX.utils.book_append_sheet(
    workbook,
    createExportWorksheet(
      XLSX,
      sortedItems,
      deliveryDatesById,
      undefined,
      idsForExport,
    ),
    'Estabilización',
  )
  appendHolidaysSheet(XLSX, workbook)

  const dateStamp = (fetchedAt ?? new Date()).toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `itsm-casos-estabilizacion-${dateStamp}.xlsx`)
}

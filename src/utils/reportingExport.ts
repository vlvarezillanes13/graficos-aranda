import * as XLSX from 'xlsx'
import {
  AFC_CONSULTORIA_GROUP,
  RESOLVED_STATE,
} from '../config/reporting'
import {
  CHILEAN_HOLIDAY_RANGE,
  CHILEAN_NATIONAL_HOLIDAYS,
} from '../config/chileanHolidays'
import { fetchItemHistory } from '../services/itemHistoryService'
import type { IncidentItem } from '../types/incident'
import {
  collectAllStateTransitions,
  findEarliestGroupTransition,
  formatHistoryTransitionValue,
  type HistoryTransition,
} from './historyTransitions'

const HISTORY_FETCH_CONCURRENCY = 5
const AFC_DATE_TIME_FORMAT = 'dd/mm/yyyy hh:mm'
const TOTAL_HOURS_FORMAT = '0.00" h"'
const BASE_COLUMN_COUNT = 3
const WORKDAY_START = '9/24'
const WORKDAY_END = '17/24'
const TOTAL_HOURS_HEADER = 'TOTAL HORAS LABORALES'

export interface AfcReportFilters {
  createdFrom: string
  createdTo: string
}

type AfcHorizontalExportRow = Record<string, string | number | null>

interface AfcTicketHistoryData {
  item: IncidentItem
  stateTransitions: HistoryTransition[]
  afcTransition: HistoryTransition | null
}

interface AfcReportRowData {
  row: AfcHorizontalExportRow
  startSequence: number
  transitionCount: number
}

export interface ReportingProgress {
  phase: 'history' | 'writing'
  done: number
  total: number
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  if (items.length === 0) return []

  const results = new Array<R>(items.length)
  let nextIndex = 0
  let completed = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
      completed += 1
      onProgress?.(completed, items.length)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )

  await Promise.all(workers)
  return results
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeStateName(value: string | null | undefined): string {
  return normalizeText(value).toLocaleLowerCase('es-CL')
}

function belongsToAfcGroup(groupName: string): boolean {
  return (
    normalizeText(groupName).localeCompare(AFC_CONSULTORIA_GROUP, undefined, {
      sensitivity: 'accent',
    }) === 0
  )
}

function parseDateInputStart(value: string): number | null {
  if (!value.trim()) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime()
}

function parseDateInputEnd(value: string): number | null {
  if (!value.trim()) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime()
}

export function isAfcReportDateRangeValid(filters: AfcReportFilters): boolean {
  const fromTs = parseDateInputStart(filters.createdFrom)
  const toTs = parseDateInputEnd(filters.createdTo)
  if (fromTs === null || toTs === null) return true
  return fromTs <= toTs
}

export function getAfcReportItems(
  items: IncidentItem[],
  filters: AfcReportFilters,
): IncidentItem[] {
  const fromTs = parseDateInputStart(filters.createdFrom)
  const toTs = parseDateInputEnd(filters.createdTo)

  return items.filter((item) => {
    if (item.stateName !== RESOLVED_STATE) return false
    if (!belongsToAfcGroup(item.groupName)) return false
    if (fromTs !== null && item.openedDate < fromTs) return false
    if (toTs !== null && item.openedDate > toTs) return false
    return true
  })
}

function timestampToExcelSerial(timestamp: number): number {
  const date = new Date(timestamp)
  const epoch = date.getTime()
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
  const excelEpoch = Date.UTC(1899, 11, 30)
  return (epoch - timezoneOffset - excelEpoch) / 86400000
}

function isoDateToExcelSerial(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return timestampToExcelSerial(new Date(year, month - 1, day, 0, 0, 0, 0).getTime())
}

function columnIndexToLetter(index: number): string {
  let letter = ''
  let value = index + 1

  while (value > 0) {
    const remainder = (value - 1) % 26
    letter = String.fromCharCode(65 + remainder) + letter
    value = Math.floor((value - 1) / 26)
  }

  return letter
}

function fechaColumnIndex(sequence: number): number {
  return BASE_COLUMN_COUNT + (sequence - 1) * 3 + 2
}

function fechaColumnLetter(sequence: number): string {
  return columnIndexToLetter(fechaColumnIndex(sequence))
}

function getTotalHoursColumnIndex(maxTransitions: number): number {
  return BASE_COLUMN_COUNT + maxTransitions * 3
}

function findOpenToInProgressSequence(
  transitions: HistoryTransition[],
): number {
  for (let index = 0; index < transitions.length; index += 1) {
    const oldState = normalizeStateName(transitions[index].detail.oldValue)
    const newState = normalizeStateName(transitions[index].detail.newValue)

    if (oldState === 'open' && newState === 'in progress') {
      return index + 1
    }
  }

  return transitions.length > 0 ? 1 : 0
}

function buildBusinessHoursPairFormula(
  startRef: string,
  endRef: string,
): string {
  const holidays = CHILEAN_HOLIDAY_RANGE

  return (
    `IF(OR(${startRef}="",${endRef}="",${endRef}<=${startRef}),0,` +
    `IF(INT(${startRef})=INT(${endRef}),` +
    `IF(AND(WEEKDAY(${startRef},2)<=5,COUNTIF(${holidays},INT(${startRef}))=0),` +
    `MAX(0,(MIN(${endRef},INT(${startRef})+${WORKDAY_END})-MAX(${startRef},INT(${startRef})+${WORKDAY_START}))*24),0),` +
    `IF(AND(WEEKDAY(${startRef},2)<=5,COUNTIF(${holidays},INT(${startRef}))=0),` +
    `MAX(0,(INT(${startRef})+${WORKDAY_END}-MAX(${startRef},INT(${startRef})+${WORKDAY_START}))*24),0)+` +
    `IF(AND(WEEKDAY(${endRef},2)<=5,COUNTIF(${holidays},INT(${endRef}))=0),` +
    `MAX(0,(MIN(${endRef},INT(${endRef})+${WORKDAY_END})-(INT(${endRef})+${WORKDAY_START}))*24),0)+` +
    `MAX(0,NETWORKDAYS(INT(${startRef})+1,INT(${endRef})-1,${holidays}))*8))`
  )
}

function buildTotalBusinessHoursFormula(
  excelRow: number,
  startSequence: number,
  transitionCount: number,
): string {
  if (transitionCount <= startSequence || startSequence <= 0) {
    return '0'
  }

  const pairFormulas: string[] = []

  for (let sequence = startSequence; sequence < transitionCount; sequence += 1) {
    const startRef = `${fechaColumnLetter(sequence)}${excelRow}`
    const endRef = `${fechaColumnLetter(sequence + 1)}${excelRow}`
    pairFormulas.push(buildBusinessHoursPairFormula(startRef, endRef))
  }

  if (pairFormulas.length === 0) return '0'
  if (pairFormulas.length === 1) return pairFormulas[0]
  return `SUM(${pairFormulas.join(',')})`
}

async function fetchAfcTicketHistoryData(
  item: IncidentItem,
): Promise<AfcTicketHistoryData> {
  const history = await fetchItemHistory(item)

  return {
    item,
    stateTransitions: collectAllStateTransitions(history),
    afcTransition: findEarliestGroupTransition(history, AFC_CONSULTORIA_GROUP),
  }
}

function buildAfcReportRowData(
  data: AfcTicketHistoryData,
  maxTransitions: number,
): AfcReportRowData {
  const { item, stateTransitions, afcTransition } = data

  const row: AfcHorizontalExportRow = {
    'N° TICKET': item.idByProject,
    'FECHA CREACIÓN': timestampToExcelSerial(item.openedDate),
    'FECHA PASO A CL-CONSULTORIA AFC': afcTransition
      ? timestampToExcelSerial(afcTransition.timestamp)
      : null,
  }

  for (let index = 0; index < maxTransitions; index += 1) {
    const sequence = index + 1
    const transition = stateTransitions[index]

    if (transition) {
      row[`ESTADO ANTERIOR ${sequence}`] = formatHistoryTransitionValue(
        transition.detail.oldValue,
      )
      row[`ESTADO NUEVO ${sequence}`] = formatHistoryTransitionValue(
        transition.detail.newValue,
      )
      row[`FECHA ${sequence}`] = timestampToExcelSerial(transition.timestamp)
    } else {
      row[`ESTADO ANTERIOR ${sequence}`] = ''
      row[`ESTADO NUEVO ${sequence}`] = ''
      row[`FECHA ${sequence}`] = null
    }
  }

  return {
    row,
    startSequence: findOpenToInProgressSequence(stateTransitions),
    transitionCount: stateTransitions.length,
  }
}

function getDateColumnIndexes(maxTransitions: number): number[] {
  const indexes = [1, 2]

  for (let index = 0; index < maxTransitions; index += 1) {
    indexes.push(BASE_COLUMN_COUNT + index * 3 + 2)
  }

  return indexes
}

function applyWorksheetDateFormats(
  worksheet: XLSX.WorkSheet,
  maxTransitions: number,
): void {
  if (!worksheet['!ref']) return

  const range = XLSX.utils.decode_range(worksheet['!ref'])
  const dateColumnIndexes = getDateColumnIndexes(maxTransitions)
  const totalHoursColumnIndex = getTotalHoursColumnIndex(maxTransitions)

  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    for (const column of dateColumnIndexes) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: column })
      const cell = worksheet[cellRef]
      if (!cell || typeof cell.v !== 'number') continue
      cell.t = 'n'
      cell.z = AFC_DATE_TIME_FORMAT
    }

    const totalCellRef = XLSX.utils.encode_cell({
      r: row,
      c: totalHoursColumnIndex,
    })
    const totalCell = worksheet[totalCellRef]
    if (totalCell?.f) {
      totalCell.t = 'n'
      totalCell.z = TOTAL_HOURS_FORMAT
    }
  }
}

function buildAfcReportHeaders(maxTransitions: number): string[] {
  const headers = [
    'N° TICKET',
    'FECHA CREACIÓN',
    'FECHA PASO A CL-CONSULTORIA AFC',
  ]

  for (let sequence = 1; sequence <= maxTransitions; sequence += 1) {
    headers.push(
      `ESTADO ANTERIOR ${sequence}`,
      `ESTADO NUEVO ${sequence}`,
      `FECHA ${sequence}`,
    )
  }

  headers.push(TOTAL_HOURS_HEADER)
  return headers
}

function rowToOrderedValues(
  row: AfcHorizontalExportRow,
  headers: string[],
): (string | number | null)[] {
  return headers.map((header) => {
    if (header === TOTAL_HOURS_HEADER) return ''
    const value = row[header]
    return value === undefined ? '' : value
  })
}

function applyTotalHoursFormulas(
  worksheet: XLSX.WorkSheet,
  rowData: AfcReportRowData[],
  maxTransitions: number,
): void {
  const totalHoursColumnIndex = getTotalHoursColumnIndex(maxTransitions)

  rowData.forEach((data, index) => {
    const excelRow = index + 2
    const cellRef = XLSX.utils.encode_cell({
      r: excelRow - 1,
      c: totalHoursColumnIndex,
    })

    worksheet[cellRef] = {
      f: buildTotalBusinessHoursFormula(
        excelRow,
        data.startSequence,
        data.transitionCount,
      ),
      t: 'n',
      z: TOTAL_HOURS_FORMAT,
    }
  })
}

function createHolidaysWorksheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [['Fecha', 'Feriado']]

  for (const holiday of CHILEAN_NATIONAL_HOLIDAYS) {
    rows.push([isoDateToExcelSerial(holiday.date), holiday.name])
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows)

  for (let row = 1; row < rows.length; row += 1) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: 0 })
    const cell = worksheet[cellRef]
    if (!cell || typeof cell.v !== 'number') continue
    cell.t = 'n'
    cell.z = 'dd/mm/yyyy'
  }

  worksheet['!cols'] = [{ wch: 14 }, { wch: 42 }]
  return worksheet
}

function createAfcReportWorksheet(
  rowData: AfcReportRowData[],
  maxTransitions: number,
): XLSX.WorkSheet {
  const headers = buildAfcReportHeaders(maxTransitions)
  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...rowData.map((data) => rowToOrderedValues(data.row, headers)),
  ])

  applyTotalHoursFormulas(worksheet, rowData, maxTransitions)
  applyWorksheetDateFormats(worksheet, maxTransitions)

  const columnWidths = [{ wch: 16 }, { wch: 22 }, { wch: 32 }]
  for (let index = 0; index < maxTransitions; index += 1) {
    columnWidths.push({ wch: 22 }, { wch: 22 }, { wch: 22 })
  }
  columnWidths.push({ wch: 24 })
  worksheet['!cols'] = columnWidths

  return worksheet
}

export async function downloadAfcResolvedReportXlsx(
  items: IncidentItem[],
  filters: AfcReportFilters,
  fetchedAt?: Date | null,
  onProgress?: (progress: ReportingProgress) => void,
): Promise<void> {
  const reportItems = getAfcReportItems(items, filters)
  if (reportItems.length === 0) return

  onProgress?.({ phase: 'history', done: 0, total: reportItems.length })

  const ticketData = await mapWithConcurrency(
    reportItems,
    HISTORY_FETCH_CONCURRENCY,
    fetchAfcTicketHistoryData,
    (done, total) => onProgress?.({ phase: 'history', done, total }),
  )

  onProgress?.({
    phase: 'writing',
    done: reportItems.length,
    total: reportItems.length,
  })

  const maxTransitions = ticketData.reduce(
    (max, data) => Math.max(max, data.stateTransitions.length),
    0,
  )

  const sortedRowData = ticketData
    .map((data) => buildAfcReportRowData(data, maxTransitions))
    .sort((a, b) =>
      String(a.row['N° TICKET']).localeCompare(String(b.row['N° TICKET'])),
    )

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    createAfcReportWorksheet(sortedRowData, maxTransitions),
    'Historial AFC',
  )
  XLSX.utils.book_append_sheet(workbook, createHolidaysWorksheet(), 'Feriados')

  const dateStamp = (fetchedAt ?? new Date()).toISOString().slice(0, 10)
  XLSX.writeFile(
    workbook,
    `itsm-historial-consultoria-afc-${dateStamp}.xlsx`,
  )
}

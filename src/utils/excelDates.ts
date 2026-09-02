import type { WorkSheet } from 'xlsx'
import { CHILEAN_NATIONAL_HOLIDAYS } from '../config/chileanHolidays'

type XlsxModule = typeof import('xlsx')

export const EXCEL_DATE_TIME_FORMAT = 'dd/mm/yyyy hh:mm'
export const EXCEL_DATE_FORMAT = 'dd/mm/yyyy'

const SPANISH_MONTH_ABBR = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

export const EMPTY_DATE_PLACEHOLDER = '—'

const SPANISH_MONTH_MATCH_ARRAY = `{"${SPANISH_MONTH_ABBR.join('";"')}"}`

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function timestampToExcelSerial(timestamp: number): number {
  const date = new Date(timestamp)
  const epoch = date.getTime()
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
  const excelEpoch = Date.UTC(1899, 11, 30)
  return (epoch - timezoneOffset - excelEpoch) / 86400000
}

export function timestampToExcelSerialOrNull(
  timestamp: number | null | undefined,
): number | null {
  if (timestamp == null) return null
  return timestampToExcelSerial(timestamp)
}

export function isoDateToExcelSerial(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return timestampToExcelSerial(new Date(year, month - 1, day, 0, 0, 0, 0).getTime())
}

export function formatSpanishExportDate(
  timestamp: number | null | undefined,
): string {
  if (timestamp == null) return EMPTY_DATE_PLACEHOLDER

  const date = new Date(timestamp)
  const day = pad2(date.getDate())
  const month = SPANISH_MONTH_ABBR[date.getMonth()]
  const year = date.getFullYear()
  const hours = pad2(date.getHours())
  const minutes = pad2(date.getMinutes())

  return `${day} ${month} ${year}, ${hours}:${minutes}`
}

export function buildSpanishTextDateFormula(dateText: string): string {
  const escaped = dateText.replace(/"/g, '""')

  return (
    `IFERROR(DATE(VALUE(MID("${escaped}",8,4)),` +
    `MATCH(MID("${escaped}",4,3),${SPANISH_MONTH_MATCH_ARRAY},0),` +
    `VALUE(LEFT("${escaped}",2)))+` +
    `TIME(VALUE(MID("${escaped}",14,2)),VALUE(MID("${escaped}",17,2)),0),"")`
  )
}

export function columnIndexToLetter(index: number): string {
  let letter = ''
  let value = index + 1

  while (value > 0) {
    const remainder = (value - 1) % 26
    letter = String.fromCharCode(65 + remainder) + letter
    value = Math.floor((value - 1) / 26)
  }

  return letter
}

export function createHolidaysWorksheet(XLSX: XlsxModule): WorkSheet {
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
    cell.z = EXCEL_DATE_FORMAT
  }

  worksheet['!cols'] = [{ wch: 14 }, { wch: 42 }]
  return worksheet
}

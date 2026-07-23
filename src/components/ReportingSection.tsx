import { useCallback, useMemo, useState } from 'react'
import type { IncidentItem } from '../types/incident'
import { fetchDeliveryDatesForItems } from '../services/deliveryDatesService'
import {
  downloadIncidentsXlsx,
  getExportCounts,
} from '../utils/exportXlsx'
import {
  downloadAfcResolvedReportXlsx,
  getAfcReportItems,
  isAfcReportDateRangeValid,
  type AfcReportFilters,
  type ReportingProgress,
} from '../utils/reportingExport'
import { AFC_CONSULTORIA_GROUP } from '../config/reporting'

interface ReportingSectionProps {
  items: IncidentItem[]
  fetchedAt: Date | null
  disabled?: boolean
}

type ExportKind = 'all' | 'afc-resolved'
type ReportingTab = 'all' | 'afc'

const EMPTY_AFC_FILTERS: AfcReportFilters = {
  createdFrom: '',
  createdTo: '',
}

function getProgressLabel(progress: ReportingProgress): string {
  if (progress.phase === 'writing') {
    return 'Generando archivo...'
  }

  return `Consultando historial (${progress.done}/${progress.total})...`
}

export function ReportingSection({
  items,
  fetchedAt,
  disabled = false,
}: ReportingSectionProps) {
  const [activeTab, setActiveTab] = useState<ReportingTab>('all')
  const [exporting, setExporting] = useState<ExportKind | null>(null)
  const [progress, setProgress] = useState<ReportingProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [afcFilters, setAfcFilters] =
    useState<AfcReportFilters>(EMPTY_AFC_FILTERS)

  const exportCounts = useMemo(() => getExportCounts(items), [items])
  const afcReportItems = useMemo(
    () => getAfcReportItems(items, afcFilters),
    [items, afcFilters],
  )
  const afcDateRangeValid = useMemo(
    () => isAfcReportDateRangeValid(afcFilters),
    [afcFilters],
  )

  const updateAfcFilters = useCallback((partial: Partial<AfcReportFilters>) => {
    setAfcFilters((current) => ({ ...current, ...partial }))
    setError(null)
  }, [])

  const handleExportAll = useCallback(async () => {
    if (items.length === 0) return

    setExporting('all')
    setProgress(null)
    setError(null)

    try {
      const dates = await fetchDeliveryDatesForItems(items)
      downloadIncidentsXlsx(items, fetchedAt, dates)
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'No se pudo generar el XLSX completo',
      )
    } finally {
      setExporting(null)
      setProgress(null)
    }
  }, [items, fetchedAt])

  const handleExportAfcResolved = useCallback(async () => {
    if (afcReportItems.length === 0 || !afcDateRangeValid) return

    setExporting('afc-resolved')
    setProgress({ phase: 'history', done: 0, total: afcReportItems.length })
    setError(null)

    try {
      await downloadAfcResolvedReportXlsx(
        items,
        afcFilters,
        fetchedAt,
        setProgress,
      )
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'No se pudo generar el reporte AFC',
      )
    } finally {
      setExporting(null)
      setProgress(null)
    }
  }, [items, afcFilters, fetchedAt, afcReportItems.length, afcDateRangeValid])

  const isBusy = exporting !== null

  return (
    <section className="reporting-panel panel">
      <header className="reporting-panel-header">
        <div>
          <h2>Exportaciones disponibles</h2>
          <p>
            Elige el tipo de reporte y descarga el XLSX con los datos actuales o
            el historial AFC.
          </p>
        </div>
      </header>

      <div className="reporting-panel-body">
        <div
          className="panel-tabs cols-2"
          role="tablist"
          aria-label="Tipos de exportación"
        >
          <button
            type="button"
            role="tab"
            id="reporting-tab-all"
            aria-selected={activeTab === 'all'}
            aria-controls="reporting-panel-all"
            className={`panel-tab is-all ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            disabled={isBusy}
          >
            <span className="panel-tab-icon" aria-hidden>
              ⬚
            </span>
            <span className="panel-tab-copy">
              <strong>Datos completos</strong>
              <small>Todos los tickets cargados</small>
            </span>
            <span className="panel-tab-badge">{exportCounts.total}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="reporting-tab-afc"
            aria-selected={activeTab === 'afc'}
            aria-controls="reporting-panel-afc"
            className={`panel-tab is-afc ${activeTab === 'afc' ? 'active' : ''}`}
            onClick={() => setActiveTab('afc')}
            disabled={isBusy}
          >
            <span className="panel-tab-icon" aria-hidden>
              ◷
            </span>
            <span className="panel-tab-copy">
              <strong>Resueltos · Consultoría AFC</strong>
              <small>Historial y horas laborales</small>
            </span>
            <span className="panel-tab-badge is-accent">
              {afcReportItems.length}
            </span>
          </button>
        </div>

        {activeTab === 'all' && (
          <article
            id="reporting-panel-all"
            role="tabpanel"
            aria-labelledby="reporting-tab-all"
            className="panel-tab-panel is-all"
          >
            <div className="panel-tab-panel-intro">
              <h3>Exportación general</h3>
              <p>
                Incluye todos los tickets cargados con detalle operativo,
                fechas de entrega y campos AFC. Genera un archivo con hojas
                Todos, Abiertos y Cerrados.
              </p>
            </div>

            <dl className="reporting-stats">
              <div>
                <dt>Total</dt>
                <dd>{exportCounts.total}</dd>
              </div>
              <div>
                <dt>Abiertos</dt>
                <dd>{exportCounts.open}</dd>
              </div>
              <div>
                <dt>Cerrados</dt>
                <dd>{exportCounts.closed}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="reporting-button"
              onClick={() => void handleExportAll()}
              disabled={disabled || isBusy || items.length === 0}
            >
              {exporting === 'all'
                ? 'Preparando XLSX...'
                : `Descargar XLSX completo (${exportCounts.total})`}
            </button>
          </article>
        )}

        {activeTab === 'afc' && (
          <article
            id="reporting-panel-afc"
            role="tabpanel"
            aria-labelledby="reporting-tab-afc"
            className="panel-tab-panel is-afc"
          >
            <div className="panel-tab-panel-intro">
              <h3>Reporte AFC resuelto</h3>
              <p>
                Solo tickets resueltos del grupo {AFC_CONSULTORIA_GROUP}. Por
                fila exporta creación, primer paso al grupo, cambios de estado
                en columnas y total de horas laborales con fórmula Excel.
              </p>
            </div>

            <div className="reporting-filters">
              <label>
                Creación desde
                <input
                  type="date"
                  value={afcFilters.createdFrom}
                  onChange={(event) =>
                    updateAfcFilters({ createdFrom: event.target.value })
                  }
                  disabled={disabled || isBusy}
                />
              </label>

              <label>
                Creación hasta
                <input
                  type="date"
                  value={afcFilters.createdTo}
                  onChange={(event) =>
                    updateAfcFilters({ createdTo: event.target.value })
                  }
                  disabled={disabled || isBusy}
                />
              </label>

              {(afcFilters.createdFrom || afcFilters.createdTo) && (
                <button
                  type="button"
                  className="reporting-filter-reset"
                  onClick={() => setAfcFilters(EMPTY_AFC_FILTERS)}
                  disabled={disabled || isBusy}
                >
                  Limpiar fechas
                </button>
              )}
            </div>

            <p className="reporting-filter-meta">
              {afcReportItems.length} ticket
              {afcReportItems.length === 1 ? '' : 's'} coincide
              {afcReportItems.length === 1 ? '' : 'n'} con el filtro
            </p>

            {!afcDateRangeValid && (
              <p className="reporting-filter-error" role="alert">
                La fecha desde no puede ser posterior a la fecha hasta.
              </p>
            )}

            <button
              type="button"
              className="reporting-button reporting-button-accent"
              onClick={() => void handleExportAfcResolved()}
              disabled={
                disabled ||
                isBusy ||
                afcReportItems.length === 0 ||
                !afcDateRangeValid
              }
            >
              {exporting === 'afc-resolved' && progress
                ? getProgressLabel(progress)
                : `Descargar reporte AFC (${afcReportItems.length})`}
            </button>
          </article>
        )}

        {isBusy && progress && exporting === 'afc-resolved' && (
          <div className="reporting-progress" aria-live="polite">
            <div
              className="reporting-progress-bar"
              style={{
                width: `${Math.max(8, (progress.done / progress.total) * 100)}%`,
              }}
            />
            <span>{getProgressLabel(progress)}</span>
          </div>
        )}

        {error && (
          <p className="reporting-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

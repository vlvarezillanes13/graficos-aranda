import { LoadingState } from '../components/LoadingState'
import { ReportingSection } from '../components/ReportingSection'
import type { IncidentItem } from '../types/incident'

interface ReportingPageProps {
  items: IncidentItem[]
  fetchedAt: Date | null
  loading: boolean
  error: string | null
}

export function ReportingPage({
  items,
  fetchedAt,
  loading,
  error,
}: ReportingPageProps) {
  return (
    <>
      <header className="hero hero-reporting">
        <div className="hero-content">
          <p className="eyebrow">ITSM SONDA · Reportería</p>
          <h1>Exportaciones y reportes AFC</h1>
          <p className="subtitle">
            Descarga XLSX con datos actuales e historial de estados para
            Consultoría AFC.
          </p>
          {fetchedAt && !loading && (
            <p className="last-update">
              Última actualización:{' '}
              {new Intl.DateTimeFormat('es-CL', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(fetchedAt)}
            </p>
          )}
        </div>
      </header>

      <main className="app reporting-page">
        {loading && <LoadingState />}

        {error && (
          <div className="alert error" role="alert">
            <strong>No se pudieron cargar los datos.</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <ReportingSection
            items={items}
            fetchedAt={fetchedAt}
            disabled={loading}
          />
        )}
      </main>
    </>
  )
}

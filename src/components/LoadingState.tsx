interface LoadingStateProps {
  message?: string
  hint?: string | null
}

export function LoadingState({
  message = 'Consultando ITSM SONDA...',
  hint = 'Obteniendo todos los registros paginados',
}: LoadingStateProps) {
  return (
    <div className="loading-state">
      <div className="loading-spinner" aria-hidden />
      <p>{message}</p>
      {hint ? <span className="loading-hint">{hint}</span> : null}
    </div>
  )
}

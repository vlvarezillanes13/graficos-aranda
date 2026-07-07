interface LoadingStateProps {
  message?: string
}

export function LoadingState({
  message = 'Consultando ITSM SONDA...',
}: LoadingStateProps) {
  return (
    <div className="loading-state">
      <div className="loading-spinner" aria-hidden />
      <p>{message}</p>
      <span className="loading-hint">Obteniendo todos los registros paginados</span>
    </div>
  )
}

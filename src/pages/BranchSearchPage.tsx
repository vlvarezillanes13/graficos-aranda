import { useCallback, useState } from 'react'
import {
  searchAzureDevOpsBranches,
  type BranchSearchHit,
  type BranchSearchResult,
} from '../services/adoBranchSearchService'

export function BranchSearchPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BranchSearchResult | null>(null)

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setError('Indica al menos 2 caracteres para buscar')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await searchAzureDevOpsBranches(trimmed)
      setResult(data)
    } catch (searchError) {
      setResult(null)
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'No se pudo completar la búsqueda',
      )
    } finally {
      setLoading(false)
    }
  }, [query])

  return (
    <>
      <header className="hero hero-admin">
        <div className="hero-content">
          <p className="eyebrow">ITSM SONDA · Administración</p>
          <h1>Buscador de ramas Azure DevOps</h1>
          <p className="subtitle">
            Apartado solo para administradores. Busca ramas en toda la
            organización usando el PAT configurado en el servidor.
          </p>
        </div>
      </header>

      <main className="app admin-page">
        <section className="admin-panel panel">
          <header className="admin-panel-header">
            <div>
              <h2>Búsqueda global de ramas</h2>
              <p>
                Similar al script local: recorre proyectos y repositorios y
                muestra las ramas que contienen el texto indicado.
              </p>
            </div>
          </header>

          <div className="admin-panel-body">
            <form
              className="admin-search-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleSearch()
              }}
            >
              <label className="admin-search-field">
                <span>Texto de la rama</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ej: feature/DA-1234"
                  disabled={loading}
                  autoFocus
                />
              </label>

              <button
                type="submit"
                className="reporting-button"
                disabled={loading || query.trim().length < 2}
              >
                {loading ? 'Buscando en Azure DevOps...' : 'Buscar ramas'}
              </button>
            </form>

            {loading && (
              <p className="admin-search-meta" aria-live="polite">
                Consultando proyectos y repositorios. Puede demorar unos
                segundos...
              </p>
            )}

            {error && (
              <p className="reporting-error" role="alert">
                {error}
              </p>
            )}

            {result && !loading && <BranchSearchResults result={result} />}
          </div>
        </section>
      </main>
    </>
  )
}

function BranchSearchResults({ result }: { result: BranchSearchResult }) {
  const results = Array.isArray(result.results) ? result.results : []
  const projectsScanned = result.projectsScanned ?? 0
  const repositoriesScanned = result.repositoriesScanned ?? 0
  const organization = result.organization || 'DA-AFP'
  const query = result.query || ''

  return (
    <div className="admin-search-results">
      <p className="admin-search-meta">
        Organización <strong>{organization}</strong> · búsqueda{' '}
        <strong>{query}</strong> · {projectsScanned} proyecto
        {projectsScanned === 1 ? '' : 's'} · {repositoriesScanned} repo
        {repositoriesScanned === 1 ? '' : 's'} ·{' '}
        <strong>{results.length}</strong> coincidencia
        {results.length === 1 ? '' : 's'}
      </p>

      {results.length === 0 ? (
        <p className="admin-search-empty">
          No se encontró ninguna rama que contenga “{query}”.
        </p>
      ) : (
        <div className="admin-results-table-wrap">
          <table className="admin-results-table">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Repositorio</th>
                <th>Rama</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {results.map((hit) => (
                <BranchResultRow
                  key={`${hit.proyecto}-${hit.repositorio}-${hit.rama}`}
                  hit={hit}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function BranchResultRow({ hit }: { hit: BranchSearchHit }) {
  return (
    <tr>
      <td>{hit.proyecto}</td>
      <td>{hit.repositorio}</td>
      <td>
        <code>{hit.rama}</code>
      </td>
      <td>
        <a href={hit.url} target="_blank" rel="noopener noreferrer">
          Abrir en Azure DevOps
        </a>
      </td>
    </tr>
  )
}

import { useCallback, useState } from 'react'
import {
  searchAzureDevOpsBranches,
  searchAzureDevOpsItems,
  type BranchSearchHit,
  type BranchSearchResult,
  type ItemSearchHit,
  type ItemSearchResult,
  type ItemSearchTipo,
} from '../services/adoBranchSearchService'

type SearchMode = 'branches' | 'items'

const ITEM_TIPO_LABEL: Record<ItemSearchTipo, string> = {
  proyecto: 'Proyecto',
  componente: 'Componente',
  repositorio: 'Repositorio',
  carpeta: 'Carpeta',
  archivo: 'Archivo',
}

export function BranchSearchPage() {
  const [mode, setMode] = useState<SearchMode>('branches')
  const [query, setQuery] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branchResult, setBranchResult] = useState<BranchSearchResult | null>(
    null,
  )
  const [itemResult, setItemResult] = useState<ItemSearchResult | null>(null)

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setError('Indica al menos 2 caracteres para buscar')
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (mode === 'branches') {
        const data = await searchAzureDevOpsBranches(trimmed)
        setBranchResult(data)
      } else {
        const data = await searchAzureDevOpsItems(trimmed, branchFilter)
        setItemResult(data)
      }
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'No se pudo completar la búsqueda',
      )
    } finally {
      setLoading(false)
    }
  }, [query, branchFilter, mode])

  const isItems = mode === 'items'

  return (
    <>
      <header className="hero hero-admin">
        <div className="hero-content">
          <p className="eyebrow">ITSM SONDA · Administración</p>
          <h1>Buscador Azure DevOps</h1>
          <p className="subtitle">
            Apartado solo para administradores. Busca ramas, proyectos y
            componentes en toda la organización usando el PAT configurado en el
            servidor.
          </p>
        </div>
      </header>

      <main className="app admin-page">
        <section className="admin-panel panel">
          <header className="admin-panel-header">
            <div>
              <h2>Búsqueda global</h2>
              <p>
                Recorre proyectos, repositorios y ramas. En componentes busca
                por el nombre técnico o una descripción: por ejemplo{' '}
                <code>Sonda.Api.ComprobantesPDA</code> o{' '}
                <code>comprobante PDA</code>.
              </p>
            </div>
          </header>

          <div className="admin-panel-body">
            <div className="panel-tabs cols-2" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!isItems}
                className={['panel-tab', 'is-all', !isItems ? 'active' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setMode('branches')}
              >
                <span className="panel-tab-icon" aria-hidden>
                  ⎇
                </span>
                <span className="panel-tab-copy">
                  <strong>Ramas</strong>
                  <small>Nombre de rama en todos los repos</small>
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isItems}
                className={[
                  'panel-tab',
                  'is-analysis',
                  isItems ? 'active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setMode('items')}
              >
                <span className="panel-tab-icon" aria-hidden>
                  ⊞
                </span>
                <span className="panel-tab-copy">
                  <strong>Proyectos / componentes</strong>
                  <small>Carpetas en todos los proyectos y ramas</small>
                </span>
              </button>
            </div>

            <form
              className="admin-search-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleSearch()
              }}
            >
              <label className="admin-search-field">
                <span>
                  {isItems
                    ? 'Nombre de proyecto o componente'
                    : 'Texto de la rama'}
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    isItems
                      ? 'Ej: ComprobantesPDA o comprobante PDA'
                      : 'Ej: feature/DA-1234'
                  }
                  disabled={loading}
                  autoFocus
                />
              </label>

              {isItems && (
                <label className="admin-search-field">
                  <span>Filtrar por rama (opcional)</span>
                  <input
                    type="search"
                    value={branchFilter}
                    onChange={(event) => setBranchFilter(event.target.value)}
                    placeholder="Vacío = todas las ramas"
                    disabled={loading}
                  />
                </label>
              )}

              <button
                type="submit"
                className="reporting-button"
                disabled={loading || query.trim().length < 2}
              >
                {loading
                  ? 'Buscando en Azure DevOps...'
                  : isItems
                    ? 'Buscar proyectos / componentes'
                    : 'Buscar ramas'}
              </button>
            </form>

            {loading && (
              <p className="admin-search-meta" aria-live="polite">
                {isItems
                  ? 'Consultando carpetas en proyectos, repositorios y ramas. Puede demorar unos segundos...'
                  : 'Consultando proyectos y repositorios. Puede demorar unos segundos...'}
              </p>
            )}

            {error && (
              <p className="reporting-error" role="alert">
                {error}
              </p>
            )}

            {!isItems && branchResult && (
              <BranchSearchResults result={branchResult} />
            )}

            {isItems && itemResult && (
              <ItemSearchResults result={itemResult} />
            )}
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

function ItemSearchResults({ result }: { result: ItemSearchResult }) {
  const results = Array.isArray(result.results) ? result.results : []
  const projectsScanned = result.projectsScanned ?? 0
  const repositoriesScanned = result.repositoriesScanned ?? 0
  const branchesScanned = result.branchesScanned ?? 0
  const organization = result.organization || 'DA-AFP'
  const query = result.query || ''
  const branchFilter = result.branchFilter || ''

  return (
    <div className="admin-search-results">
      <p className="admin-search-meta">
        Organización <strong>{organization}</strong> · búsqueda{' '}
        <strong>{query}</strong>
        {branchFilter ? (
          <>
            {' '}
            · ramas con <strong>{branchFilter}</strong>
          </>
        ) : (
          ' · todas las ramas'
        )}{' '}
        · {projectsScanned} proyecto{projectsScanned === 1 ? '' : 's'} ·{' '}
        {repositoriesScanned} repo{repositoriesScanned === 1 ? '' : 's'} ·{' '}
        {branchesScanned} rama{branchesScanned === 1 ? '' : 's'} ·{' '}
        <strong>{results.length}</strong> coincidencia
        {results.length === 1 ? '' : 's'}
      </p>

      {result.truncated && (
        <p className="admin-search-warning">
          La búsqueda se detuvo por tiempo. Los resultados pueden estar
          incompletos; prueba un nombre más específico o filtra por rama.
        </p>
      )}

      {results.length === 0 ? (
        <p className="admin-search-empty">
          No se encontró ningún proyecto o componente que contenga “{query}”.
        </p>
      ) : (
        <div className="admin-results-table-wrap">
          <table className="admin-results-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Proyecto ADO</th>
                <th>Repositorio</th>
                <th>Ruta</th>
                <th>Ramas</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {results.map((hit) => (
                <ItemResultRow
                  key={`${hit.tipo}-${hit.proyecto}-${hit.repositorio}-${hit.path}`}
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

function ItemResultRow({ hit }: { hit: ItemSearchHit }) {
  const tipo = hit.tipo in ITEM_TIPO_LABEL ? hit.tipo : 'carpeta'

  return (
    <tr>
      <td>
        <span className={`admin-type-badge is-${tipo}`}>
          {ITEM_TIPO_LABEL[tipo]}
        </span>
      </td>
      <td>{hit.proyecto || '—'}</td>
      <td>{hit.repositorio || '—'}</td>
      <td>
        {hit.path ? <code>{hit.path}</code> : <span>—</span>}
      </td>
      <td>
        <BranchChips ramas={Array.isArray(hit.ramas) ? hit.ramas : []} />
      </td>
      <td>
        <a href={hit.url} target="_blank" rel="noopener noreferrer">
          Abrir en Azure DevOps
        </a>
      </td>
    </tr>
  )
}

function BranchChips({ ramas }: { ramas: string[] }) {
  if (ramas.length === 0) return <span>—</span>

  const visible = ramas.slice(0, 8)
  const extra = ramas.length - visible.length

  return (
    <div className="admin-branch-chips">
      {visible.map((rama) => (
        <code key={rama} className="admin-branch-chip">
          {rama}
        </code>
      ))}
      {extra > 0 && (
        <span className="admin-branch-more">+{extra} más</span>
      )}
    </div>
  )
}

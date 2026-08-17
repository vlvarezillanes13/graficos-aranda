import { getAuthHeaders } from './authService'

export interface BranchSearchHit {
  proyecto: string
  repositorio: string
  rama: string
  url: string
}

export interface BranchSearchResult {
  results: BranchSearchHit[]
  projectsScanned: number
  repositoriesScanned: number
  query: string
  organization: string
}

function normalizeBranchSearchResult(
  data: unknown,
  fallbackQuery: string,
): BranchSearchResult {
  const record =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {}

  const results = Array.isArray(record.results)
    ? (record.results as BranchSearchHit[])
    : []

  return {
    results,
    projectsScanned:
      typeof record.projectsScanned === 'number' ? record.projectsScanned : 0,
    repositoriesScanned:
      typeof record.repositoriesScanned === 'number'
        ? record.repositoriesScanned
        : 0,
    query:
      typeof record.query === 'string' && record.query.trim()
        ? record.query
        : fallbackQuery,
    organization:
      typeof record.organization === 'string' && record.organization.trim()
        ? record.organization
        : 'DA-AFP',
  }
}

export async function searchAzureDevOpsBranches(
  query: string,
): Promise<BranchSearchResult> {
  const trimmed = query.trim()
  const params = new URLSearchParams({ q: trimmed })
  const response = await fetch(`/api/ado-branch-search?${params}`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && typeof data.error === 'string'
        ? data.error
        : `Error al buscar ramas (${response.status})`
    throw new Error(message)
  }

  const record =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null

  if (!record || !Array.isArray(record.results)) {
    throw new Error(
      'La API no devolvió resultados válidos. Reinicia el servidor de desarrollo.',
    )
  }

  return normalizeBranchSearchResult(data, trimmed)
}

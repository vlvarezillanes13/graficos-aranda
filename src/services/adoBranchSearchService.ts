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

export type ItemSearchTipo =
  | 'proyecto'
  | 'componente'
  | 'repositorio'
  | 'carpeta'
  | 'archivo'

export interface ItemSearchHit {
  tipo: ItemSearchTipo
  proyecto: string
  repositorio: string
  path: string
  ramas: string[]
  url: string
}

export interface ItemSearchResult {
  results: ItemSearchHit[]
  projectsScanned: number
  repositoriesScanned: number
  branchesScanned: number
  truncated: boolean
  query: string
  branchFilter: string
  organization: string
}

async function parseAdoError(
  response: Response,
  fallback: string,
): Promise<string> {
  const data = await response.json().catch(() => null)
  const record = asRecord(data)
  if (record && typeof record.error === 'string') {
    return record.error
  }
  return `${fallback} (${response.status})`
}

function asRecord(data: unknown): Record<string, unknown> | null {
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
}

function normalizeBranchSearchResult(
  data: unknown,
  fallbackQuery: string,
): BranchSearchResult {
  const record = asRecord(data) ?? {}

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

function normalizeItemSearchResult(
  data: unknown,
  fallbackQuery: string,
  fallbackBranchFilter: string,
): ItemSearchResult {
  const record = asRecord(data) ?? {}

  const results = Array.isArray(record.results)
    ? (record.results as ItemSearchHit[])
    : []

  return {
    results,
    projectsScanned:
      typeof record.projectsScanned === 'number' ? record.projectsScanned : 0,
    repositoriesScanned:
      typeof record.repositoriesScanned === 'number'
        ? record.repositoriesScanned
        : 0,
    branchesScanned:
      typeof record.branchesScanned === 'number' ? record.branchesScanned : 0,
    truncated: record.truncated === true,
    query:
      typeof record.query === 'string' && record.query.trim()
        ? record.query
        : fallbackQuery,
    branchFilter:
      typeof record.branchFilter === 'string'
        ? record.branchFilter
        : fallbackBranchFilter,
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

  if (!response.ok) {
    throw new Error(await parseAdoError(response, 'Error al buscar ramas'))
  }

  const data = await response.json().catch(() => null)
  const record = asRecord(data)

  if (!record || !Array.isArray(record.results)) {
    throw new Error(
      'La API no devolvió resultados válidos. Reinicia el servidor de desarrollo.',
    )
  }

  return normalizeBranchSearchResult(data, trimmed)
}

export async function searchAzureDevOpsItems(
  query: string,
  branchFilter = '',
): Promise<ItemSearchResult> {
  const trimmed = query.trim()
  const rama = branchFilter.trim()
  const params = new URLSearchParams({ q: trimmed })
  if (rama) params.set('rama', rama)

  const response = await fetch(`/api/ado-item-search?${params}`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  if (!response.ok) {
    throw new Error(
      await parseAdoError(response, 'Error al buscar proyectos y componentes'),
    )
  }

  const data = await response.json().catch(() => null)
  const record = asRecord(data)

  if (!record || !Array.isArray(record.results)) {
    throw new Error(
      'La API no devolvió resultados válidos. Reinicia el servidor de desarrollo.',
    )
  }

  return normalizeItemSearchResult(data, trimmed, rama)
}

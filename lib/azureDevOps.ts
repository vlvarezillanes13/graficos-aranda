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

const DEFAULT_ORG = 'DA-AFP'
const API_VERSION = '7.1'
const REPO_CONCURRENCY = 6
const ITEM_CONCURRENCY = 4
const SEARCH_DEADLINE_MS = 52_000
const NOISE_PATH =
  /\/(node_modules|bin|obj|\.vs|packages|dist|wwwroot|\.git|__pycache__)(\/|$)/i
const PROJECT_FILE_EXT = ['.sln', '.csproj', '.vbproj', '.fsproj']

interface AdoProject {
  id: string
  name: string
}

interface AdoRepository {
  id: string
  name: string
  defaultBranch?: string
  isDisabled?: boolean
}

interface GitItem {
  path?: string
  gitObjectType?: string
  isFolder?: boolean
}

interface RawItemHit {
  tipo: ItemSearchTipo
  proyecto: string
  repositorio: string
  path: string
  rama: string
  url: string
}

function getOrganization(): string {
  return (process.env.AZURE_DEVOPS_ORG ?? DEFAULT_ORG).trim() || DEFAULT_ORG
}

function getPat(): string | null {
  const raw = process.env.AZURE_DEVOPS_PAT?.trim()
  if (!raw) return null
  return raw.replace(/^["']|["']$/g, '').trim() || null
}

function buildAuthHeader(pat: string): string {
  const token = Buffer.from(`:${pat}`, 'utf8').toString('base64')
  return `Basic ${token}`
}

async function adoFetch<T>(url: string, pat: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: buildAuthHeader(pat),
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Azure DevOps ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    )
  }

  return (await response.json()) as T
}

async function adoFetchOptional<T>(url: string, pat: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: {
      Authorization: buildAuthHeader(pat),
      Accept: 'application/json',
    },
  })

  if (response.status === 404) return null

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Azure DevOps ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    )
  }

  return (await response.json()) as T
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []

  const results = new Array<R>(items.length)
  let nextIndex = 0

  const claimIndex = (): number | null => {
    if (nextIndex >= items.length) return null
    const index = nextIndex
    nextIndex += 1
    return index
  }

  async function worker() {
    for (;;) {
      const index = claimIndex()
      if (index === null) break
      results[index] = await mapper(items[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )

  return results
}

function buildBranchUrl(
  organization: string,
  projectName: string,
  repoName: string,
  branchName: string,
): string {
  const projectUrl = encodeURIComponent(projectName)
  const repoUrl = encodeURIComponent(repoName)
  const version = encodeURIComponent(`GB${branchName}`)
  return `https://dev.azure.com/${organization}/${projectUrl}/_git/${repoUrl}?version=${version}`
}

function buildProjectUrl(organization: string, projectName: string): string {
  return `https://dev.azure.com/${organization}/${encodeURIComponent(projectName)}`
}

function buildRepoUrl(
  organization: string,
  projectName: string,
  repoName: string,
): string {
  return `${buildProjectUrl(organization, projectName)}/_git/${encodeURIComponent(repoName)}`
}

function buildItemUrl(
  organization: string,
  projectName: string,
  repoName: string,
  branchName: string,
  path: string,
): string {
  const version = encodeURIComponent(`GB${branchName}`)
  const encodedPath = encodeURIComponent(path)
  return `${buildRepoUrl(organization, projectName, repoName)}?path=${encodedPath}&version=${version}`
}

function stripBranchRef(refName: string): string {
  return refName.replace(/^refs\/heads\//, '').trim()
}

function branchNamesFromCodeVersions(
  versions: Array<{ branchName?: string }> | undefined,
): string[] {
  const names: string[] = []
  for (const version of versions ?? []) {
    const name = stripBranchRef(version.branchName ?? '')
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

function basename(path: string): string {
  const trimmed = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = trimmed.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? trimmed
}

function normalizePath(path: string): string {
  const trimmed = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function parseGitItems(data: unknown): GitItem[] {
  if (Array.isArray(data)) return data as GitItem[]
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.value)) return record.value as GitItem[]
    if (typeof record.path === 'string') return [record as GitItem]
  }
  return []
}

function isFolderItem(item: GitItem): boolean {
  return item.isFolder === true || item.gitObjectType === 'tree'
}

function isNoisePath(path: string): boolean {
  return NOISE_PATH.test(normalizePath(path))
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
}

function stripExtension(name: string): string {
  const lower = name.toLowerCase()
  for (const ext of PROJECT_FILE_EXT) {
    if (lower.endsWith(ext)) return name.slice(0, -ext.length)
  }
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return name
  return name.slice(0, dot)
}

function looksLikeProjectFile(name: string): boolean {
  const lower = name.toLowerCase()
  return PROJECT_FILE_EXT.some((ext) => lower.endsWith(ext))
}

function tokenMatches(token: string, nameLower: string, nameNorm: string): boolean {
  if (nameLower.includes(token) || nameNorm.includes(token)) return true

  if (token.endsWith('s') && token.length >= 4) {
    const stem = token.slice(0, -1)
    if (nameLower.includes(stem) || nameNorm.includes(stem)) return true
  }

  return false
}

/** Matches "comprobante PDA" and "comprobantePDA" to "Sonda.Api.ComprobantesPDA". */
function nameMatches(name: string, query: string): boolean {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return false

  const comparable = looksLikeProjectFile(name) ? stripExtension(name) : name
  const nameLower = comparable.toLowerCase()
  const queryLower = trimmedQuery.toLowerCase()
  if (nameLower.includes(queryLower)) return true

  const nameNorm = nameLower.replace(/[^a-z0-9]/g, '')
  const queryNorm = queryLower.replace(/[^a-z0-9]/g, '')
  if (queryNorm.length >= 2 && nameNorm.includes(queryNorm)) return true

  const queryTokens = tokenize(trimmedQuery)
  if (queryTokens.length === 0) return false

  return queryTokens.every((token) => tokenMatches(token, nameLower, nameNorm))
}

function classifyItem(path: string, isFolder: boolean): ItemSearchTipo {
  const normalized = normalizePath(path)
  const segments = normalized.toLowerCase().split('/').filter(Boolean)
  const name = (segments[segments.length - 1] ?? '').toLowerCase()
  const ancestors = segments.slice(0, -1)

  if (name.startsWith('sonda.api.') || ancestors.includes('api')) {
    return isFolder ? 'componente' : 'archivo'
  }

  if (
    ancestors.some(
      (segment) =>
        segment === 'componentes' ||
        segment === 'componente' ||
        segment === 'components' ||
        segment === 'component',
    )
  ) {
    return 'componente'
  }

  if (
    looksLikeProjectFile(name) ||
    ancestors.some(
      (segment) =>
        segment === 'proyectos' ||
        segment === 'proyecto' ||
        segment === 'projects' ||
        segment === 'project',
    )
  ) {
    return 'proyecto'
  }

  return isFolder ? 'carpeta' : 'archivo'
}

function tipoRank(tipo: ItemSearchTipo): number {
  if (tipo === 'proyecto') return 0
  if (tipo === 'componente') return 1
  if (tipo === 'repositorio') return 2
  if (tipo === 'carpeta') return 3
  return 4
}

export function isAzureDevOpsConfigured(): boolean {
  return Boolean(getPat())
}

/** Same logic as buscar-rama-DA-AFP.ps1: scan all projects/repos for matching branches. */
export async function searchAzureDevOpsBranches(
  query: string,
): Promise<BranchSearchResult> {
  const pat = getPat()
  if (!pat) {
    throw new Error(
      'Azure DevOps no está configurado. Define AZURE_DEVOPS_PAT en el servidor.',
    )
  }

  const organization = getOrganization()
  const baseUrl = `https://dev.azure.com/${organization}`
  const ramaEncoded = encodeURIComponent(query)
  const queryLower = query.toLowerCase()

  const projectsResponse = await adoFetch<{
    value: Array<{ id: string; name: string }>
  }>(`${baseUrl}/_apis/projects?$top=1000&api-version=${API_VERSION}`, pat)

  const projects = projectsResponse.value ?? []
  const results: BranchSearchHit[] = []
  let repositoriesScanned = 0

  for (const project of projects) {
    let repositories: Array<{ id: string; name: string }> = []

    try {
      const reposResponse = await adoFetch<{
        value: Array<{ id: string; name: string }>
      }>(
        `${baseUrl}/${project.id}/_apis/git/repositories?api-version=${API_VERSION}`,
        pat,
      )
      repositories = reposResponse.value ?? []
    } catch {
      continue
    }

    repositoriesScanned += repositories.length

    const repoHits = await mapWithConcurrency(
      repositories,
      REPO_CONCURRENCY,
      async (repo) => {
        try {
          const refsResponse = await adoFetch<{
            value: Array<{ name: string }>
          }>(
            `${baseUrl}/${project.id}/_apis/git/repositories/${repo.id}/refs` +
              `?filter=heads/&filterContains=${ramaEncoded}` +
              `&$top=1000&api-version=${API_VERSION}`,
            pat,
          )

          const hits: BranchSearchHit[] = []

          for (const ref of refsResponse.value ?? []) {
            const branchName = ref.name.replace(/^refs\/heads\//, '')
            if (!branchName.toLowerCase().includes(queryLower)) continue

            hits.push({
              proyecto: project.name,
              repositorio: repo.name,
              rama: branchName,
              url: buildBranchUrl(
                organization,
                project.name,
                repo.name,
                branchName,
              ),
            })
          }

          return hits
        } catch {
          return [] as BranchSearchHit[]
        }
      },
    )

    for (const hits of repoHits) {
      results.push(...hits)
    }
  }

  results.sort((a, b) => {
    const byProject = a.proyecto.localeCompare(b.proyecto, 'es')
    if (byProject !== 0) return byProject
    const byRepo = a.repositorio.localeCompare(b.repositorio, 'es')
    if (byRepo !== 0) return byRepo
    return a.rama.localeCompare(b.rama, 'es')
  })

  return {
    results,
    projectsScanned: projects.length,
    repositoriesScanned,
    query,
    organization,
  }
}

async function listGitItems(
  baseUrl: string,
  pat: string,
  projectId: string,
  repoId: string,
  branchName: string,
  scopePath: string | null,
  recursionLevel: 'OneLevel' | 'Full',
): Promise<GitItem[]> {
  const params = new URLSearchParams({
    recursionLevel,
    'versionDescriptor.version': branchName,
    'versionDescriptor.versionType': 'branch',
    'api-version': API_VERSION,
  })
  if (scopePath) params.set('scopePath', scopePath)

  const url =
    `${baseUrl}/${projectId}/_apis/git/repositories/${repoId}/items?${params.toString()}`

  const data = await adoFetchOptional<unknown>(url, pat)
  if (!data) return []
  return parseGitItems(data)
}

function toRawHit(
  organization: string,
  projectName: string,
  repoName: string,
  branchName: string,
  path: string,
  isFolder: boolean,
): RawItemHit {
  const normalized = normalizePath(path)
  return {
    tipo: classifyItem(normalized, isFolder),
    proyecto: projectName,
    repositorio: repoName,
    path: normalized,
    rama: branchName,
    url: buildItemUrl(
      organization,
      projectName,
      repoName,
      branchName,
      normalized,
    ),
  }
}

function matchingPathFromItem(path: string, isFolder: boolean, query: string): string | null {
  const normalized = normalizePath(path)
  if (isNoisePath(normalized)) return null

  const segments = normalized.split('/').filter(Boolean)
  let acc = ''
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    acc += `/${segment}`
    const last = index === segments.length - 1
    const folderHere = !last || isFolder
    if (nameMatches(segment, query)) {
      return acc
    }
    if (last && !folderHere && looksLikeProjectFile(segment)) {
      if (nameMatches(stripExtension(segment), query)) return acc
    }
  }

  return null
}

function collectFromTree(
  items: GitItem[],
  organization: string,
  project: AdoProject,
  repo: AdoRepository,
  branchName: string,
  query: string,
): RawItemHit[] {
  const hits: RawItemHit[] = []
  const seen = new Set<string>()

  for (const item of items) {
    if (!item.path) continue
    const folder = isFolderItem(item)
    const matchPath = matchingPathFromItem(item.path, folder, query)
    if (!matchPath) continue

    const key = matchPath.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const matchedFolder = matchPath !== normalizePath(item.path) || folder
    hits.push(
      toRawHit(
        organization,
        project.name,
        repo.name,
        branchName,
        matchPath,
        matchedFolder,
      ),
    )
  }

  return collapseNestedHits(hits)
}

function collapseNestedHits(hits: RawItemHit[]): RawItemHit[] {
  return hits.filter((hit) => {
    if (!hit.path) return true
    return !hits.some(
      (other) =>
        other !== hit &&
        other.proyecto === hit.proyecto &&
        other.repositorio === hit.repositorio &&
        other.rama === hit.rama &&
        Boolean(other.path) &&
        hit.path.startsWith(`${other.path}/`),
    )
  })
}

interface CodeSearchResultItem {
  fileName?: string
  path?: string
  project?: { name?: string }
  repository?: { name?: string }
  versions?: Array<{ branchName?: string }>
}

async function searchCodeIndex(
  organization: string,
  pat: string,
  query: string,
): Promise<RawItemHit[]> {
  const compact = query.replace(/\s+/g, '')
  const sanitized = query.replace(/"/g, '')
  const wild = compact.replace(/[^a-zA-Z0-9]/g, '*')
  const parts = [`"${sanitized}"`]
  if (compact && compact.toLowerCase() !== sanitized.toLowerCase()) {
    parts.push(compact)
  }
  if (wild.length >= 3) {
    parts.push(`file:*${wild}*`)
    parts.push(`path:*${wild}*`)
  }

  const response = await fetch(
    `https://almsearch.dev.azure.com/${organization}/_apis/search/codesearchresults?api-version=${API_VERSION}`,
    {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(pat),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchText: parts.join(' OR '),
        $skip: 0,
        $top: 200,
      }),
    },
  )

  if (!response.ok) return []

  const data = (await response.json().catch(() => null)) as {
    results?: CodeSearchResultItem[]
  } | null

  const hits: RawItemHit[] = []
  for (const item of data?.results ?? []) {
    const projectName = item.project?.name?.trim()
    const repoName = item.repository?.name?.trim()
    const path = item.path || item.fileName
    if (!projectName || !repoName || !path) continue

    const matchPath = matchingPathFromItem(path, false, query) ?? normalizePath(path)
    const folder =
      !looksLikeProjectFile(basename(matchPath)) ||
      matchPath !== normalizePath(path)
    const versionBranches = branchNamesFromCodeVersions(item.versions)
    const branches = versionBranches.length > 0 ? versionBranches : ['']

    for (const branchName of branches) {
      hits.push(
        toRawHit(
          organization,
          projectName,
          repoName,
          branchName,
          matchPath,
          folder,
        ),
      )
    }
  }

  return collapseNestedHits(hits)
}

async function collectFromBranch(options: {
  baseUrl: string
  pat: string
  organization: string
  project: AdoProject
  repo: AdoRepository
  branchName: string
  query: string
}): Promise<RawItemHit[]> {
  let items: GitItem[] = []

  try {
    items = await listGitItems(
      options.baseUrl,
      options.pat,
      options.project.id,
      options.repo.id,
      options.branchName,
      null,
      'Full',
    )
  } catch {
    items = []
  }

  if (items.length <= 1) {
    try {
      const rootItems = await listGitItems(
        options.baseUrl,
        options.pat,
        options.project.id,
        options.repo.id,
        options.branchName,
        '/',
        'OneLevel',
      )

      const scoped: GitItem[] = []
      for (const root of rootItems) {
        if (!root.path || !isFolderItem(root)) {
          if (root.path) scoped.push(root)
          continue
        }
        try {
          const nested = await listGitItems(
            options.baseUrl,
            options.pat,
            options.project.id,
            options.repo.id,
            options.branchName,
            normalizePath(root.path),
            'Full',
          )
          scoped.push(...(nested.length > 0 ? nested : [root]))
        } catch {
          scoped.push(root)
        }
      }
      if (scoped.length > items.length) items = scoped
    } catch {
      // Keep whatever the first listing returned.
    }
  }

  return collectFromTree(
    items,
    options.organization,
    options.project,
    options.repo,
    options.branchName,
    options.query,
  )
}

function groupItemHits(hits: RawItemHit[]): ItemSearchHit[] {
  const grouped = new Map<string, ItemSearchHit>()

  for (const hit of hits) {
    const key = `${hit.tipo}|${hit.proyecto}|${hit.repositorio}|${hit.path}`
    const existing = grouped.get(key)
    if (existing) {
      if (hit.rama && !existing.ramas.includes(hit.rama)) {
        existing.ramas.push(hit.rama)
      }
      continue
    }

    grouped.set(key, {
      tipo: hit.tipo,
      proyecto: hit.proyecto,
      repositorio: hit.repositorio,
      path: hit.path,
      ramas: hit.rama ? [hit.rama] : [],
      url: hit.url,
    })
  }

  const results = [...grouped.values()]
  for (const result of results) {
    result.ramas.sort((a, b) => a.localeCompare(b, 'es'))
  }

  results.sort((a, b) => {
    const byTipo = tipoRank(a.tipo) - tipoRank(b.tipo)
    if (byTipo !== 0) return byTipo
    const byProject = a.proyecto.localeCompare(b.proyecto, 'es')
    if (byProject !== 0) return byProject
    const byRepo = a.repositorio.localeCompare(b.repositorio, 'es')
    if (byRepo !== 0) return byRepo
    return a.path.localeCompare(b.path, 'es')
  })

  return results
}

/** Find project/component folders (and matching repo/project names) across all Git repos and branches. */
export async function searchAzureDevOpsItems(
  query: string,
  branchFilter = '',
): Promise<ItemSearchResult> {
  const pat = getPat()
  if (!pat) {
    throw new Error(
      'Azure DevOps no está configurado. Define AZURE_DEVOPS_PAT en el servidor.',
    )
  }

  const organization = getOrganization()
  const baseUrl = `https://dev.azure.com/${organization}`
  const branchFilterLower = branchFilter.trim().toLowerCase()
  const deadline = Date.now() + SEARCH_DEADLINE_MS

  const projectsResponse = await adoFetch<{ value: AdoProject[] }>(
    `${baseUrl}/_apis/projects?$top=1000&api-version=${API_VERSION}`,
    pat,
  )
  const projects = projectsResponse.value ?? []

  const rawHits: RawItemHit[] = []
  let repositoriesScanned = 0
  const defaultBranchByRepo = new Map<string, string>()

  try {
    const codeHits = await searchCodeIndex(organization, pat, query)
    rawHits.push(...codeHits)
  } catch {
    // Code Search may be disabled; git tree scan still runs.
  }

  type ScanTarget = {
    project: AdoProject
    repo: AdoRepository
    branchName: string
    isDefault: boolean
  }

  type BranchScanOutcome = {
    hits: RawItemHit[]
    scanned: boolean
    timedOut: boolean
  }

  const targets: ScanTarget[] = []

  for (const project of projects) {
    if (nameMatches(project.name, query)) {
      rawHits.push({
        tipo: 'proyecto',
        proyecto: project.name,
        repositorio: '',
        path: '',
        rama: '',
        url: buildProjectUrl(organization, project.name),
      })
    }

    let repositories: AdoRepository[] = []
    try {
      const reposResponse = await adoFetch<{ value: AdoRepository[] }>(
        `${baseUrl}/${project.id}/_apis/git/repositories?api-version=${API_VERSION}`,
        pat,
      )
      repositories = (reposResponse.value ?? []).filter((repo) => !repo.isDisabled)
    } catch {
      continue
    }

    repositoriesScanned += repositories.length

    for (const repo of repositories) {
      const defaultBranch = repo.defaultBranch
        ? stripBranchRef(repo.defaultBranch)
        : ''
      if (defaultBranch) {
        defaultBranchByRepo.set(`${project.name}|${repo.name}`, defaultBranch)
      }

      if (nameMatches(repo.name, query)) {
        rawHits.push({
          tipo: 'repositorio',
          proyecto: project.name,
          repositorio: repo.name,
          path: '',
          rama: defaultBranch,
          url: buildRepoUrl(organization, project.name, repo.name),
        })
      }

      let branchNames: string[] = []
      try {
        const refsResponse = await adoFetch<{
          value: Array<{ name: string }>
        }>(
          `${baseUrl}/${project.id}/_apis/git/repositories/${repo.id}/refs` +
            `?filter=heads/&$top=1000&api-version=${API_VERSION}`,
          pat,
        )
        branchNames = (refsResponse.value ?? [])
          .map((ref) => stripBranchRef(ref.name))
          .filter(Boolean)
      } catch {
        branchNames = defaultBranch ? [defaultBranch] : []
      }

      if (branchFilterLower) {
        branchNames = branchNames.filter((name) =>
          name.toLowerCase().includes(branchFilterLower),
        )
      }

      for (const branchName of branchNames) {
        targets.push({
          project,
          repo,
          branchName,
          isDefault: Boolean(defaultBranch) && branchName === defaultBranch,
        })
      }
    }
  }

  targets.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))

  for (const hit of rawHits) {
    if (hit.rama || !hit.repositorio) continue
    const fallback = defaultBranchByRepo.get(`${hit.proyecto}|${hit.repositorio}`)
    if (fallback) hit.rama = fallback
  }

  const scannedHits = await mapWithConcurrency(
    targets,
    ITEM_CONCURRENCY,
    async (target): Promise<BranchScanOutcome> => {
      if (Date.now() > deadline) {
        return { hits: [], scanned: false, timedOut: true }
      }

      try {
        const hits = await collectFromBranch({
          baseUrl,
          pat,
          organization,
          project: target.project,
          repo: target.repo,
          branchName: target.branchName,
          query,
        })
        return { hits, scanned: true, timedOut: false }
      } catch {
        return { hits: [], scanned: true, timedOut: false }
      }
    },
  )

  let truncated = false
  let branchesScanned = 0
  for (const outcome of scannedHits) {
    if (outcome.timedOut) truncated = true
    if (outcome.scanned) branchesScanned += 1
    rawHits.push(...outcome.hits)
  }

  return {
    results: groupItemHits(collapseNestedHits(rawHits)),
    projectsScanned: projects.length,
    repositoriesScanned,
    branchesScanned,
    truncated,
    query,
    branchFilter: branchFilter.trim(),
    organization,
  }
}

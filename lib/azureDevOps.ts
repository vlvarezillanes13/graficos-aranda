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

const DEFAULT_ORG = 'DA-AFP'
const API_VERSION = '7.1'
const REPO_CONCURRENCY = 6

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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []

  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex
      nextIndex += 1
      results[current] = await mapper(items[current])
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

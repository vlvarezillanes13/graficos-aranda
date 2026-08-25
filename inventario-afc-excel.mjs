/**
 * Inventario de repositorios y ramas del proyecto Azure DevOps AFC.
 * Lee credenciales de .env (AZURE_DEVOPS_ORG / AZURE_DEVOPS_PAT) y escribe un Excel en D:\.
 */
import fs from 'node:fs'
import zlib from 'node:zlib'

const ENV_PATH = 'D:\\React\\graficos-aranda\\.env'
const PROJECT_NAME = 'AFC'
const API_VERSION = '7.1'
const ZERO_OID = '0'.repeat(40)
const OUTPUT_PATH = 'D:\\AFC-Azure-DevOps-Proyectos-y-Ramas.xlsx'
const REPO_CONCURRENCY = 3

function loadEnv(filePath) {
  const parsed = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[key] = value.trim()
  }
  return parsed
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function authHeader(pat) {
  return `Basic ${Buffer.from(`:${pat}`, 'utf8').toString('base64')}`
}

async function adoFetch(url, pat, options = {}) {
  const method = options.method ?? 'GET'
  const body = options.body

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader(pat),
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status === 429 || response.status === 503) {
      const retryAfter = Number(response.headers.get('retry-after'))
      const waitMs = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : 1500 * 2 ** attempt
      await sleep(Math.min(waitMs, 20_000))
      continue
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      const error = new Error(
        `Azure DevOps ${response.status} ${method} ${url}: ${detail.slice(0, 240)}`,
      )
      error.status = response.status
      throw error
    }

    const json = await response.json()
    return {
      json,
      continuationToken: response.headers.get('x-ms-continuationtoken'),
    }
  }

  throw new Error(`Azure DevOps agotó reintentos: ${url}`)
}

async function listPages(buildUrl, pat, collect) {
  let token = null
  do {
    const { json, continuationToken } = await adoFetch(buildUrl(token), pat)
    const values = Array.isArray(json.value) ? json.value : []
    collect(values)
    token = continuationToken || null
  } while (token)
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    for (;;) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) break
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

function stripRef(name) {
  return String(name || '').replace(/^refs\/heads\//, '').trim()
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function laterDate(a, b) {
  if (!a) return b
  if (!b) return a
  return a.getTime() >= b.getTime() ? a : b
}

function earlierDate(a, b) {
  if (!a) return b
  if (!b) return a
  return a.getTime() <= b.getTime() ? a : b
}

async function getProject(org, pat, name) {
  try {
    const { json } = await adoFetch(
      `https://dev.azure.com/${org}/_apis/projects/${encodeURIComponent(name)}?api-version=${API_VERSION}`,
      pat,
    )
    return json
  } catch (error) {
    if (error.status !== 404) throw error
    return null
  }
}

async function listRepositories(org, pat, projectId) {
  const repos = []
  await listPages(
    (token) => {
      const params = new URLSearchParams({
        '$top': '200',
        'api-version': API_VERSION,
      })
      if (token) params.set('continuationToken', token)
      return `https://dev.azure.com/${org}/${projectId}/_apis/git/repositories?${params}`
    },
    pat,
    (page) => repos.push(...page),
  )
  return repos
}

async function listBranchRefs(org, pat, projectId, repoId) {
  const refs = []
  await listPages(
    (token) => {
      const params = new URLSearchParams({
        filter: 'heads/',
        '$top': '1000',
        'api-version': API_VERSION,
      })
      if (token) params.set('continuationToken', token)
      return `https://dev.azure.com/${org}/${projectId}/_apis/git/repositories/${repoId}/refs?${params}`
    },
    pat,
    (page) => refs.push(...page),
  )
  return refs
}

async function listBranchStats(org, pat, projectId, repoId) {
  try {
    const { json } = await adoFetch(
      `https://dev.azure.com/${org}/${projectId}/_apis/git/repositories/${repoId}/stats/branches?api-version=${API_VERSION}`,
      pat,
    )
    return Array.isArray(json.value) ? json.value : []
  } catch {
    return []
  }
}

async function getCommitsByIds(org, pat, projectId, repoId, ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  const byId = new Map()
  const chunkSize = 200

  for (let offset = 0; offset < unique.length; offset += chunkSize) {
    const chunk = unique.slice(offset, offset + chunkSize)
    try {
      const { json } = await adoFetch(
        `https://dev.azure.com/${org}/${projectId}/_apis/git/repositories/${repoId}/commitsbatch?api-version=${API_VERSION}`,
        pat,
        { method: 'POST', body: { ids: chunk, $top: chunk.length } },
      )
      for (const commit of json.value ?? json.commits ?? []) {
        if (commit.commitId) byId.set(commit.commitId.toLowerCase(), commit)
      }
    } catch {
      for (const id of chunk) {
        try {
          const { json } = await adoFetch(
            `https://dev.azure.com/${org}/${projectId}/_apis/git/repositories/${repoId}/commits/${id}?api-version=${API_VERSION}`,
            pat,
          )
          byId.set(id.toLowerCase(), json)
        } catch {
          // commit no disponible
        }
      }
    }
  }

  return byId
}

async function getBranchCreationDates(org, pat, projectId, repoId) {
  const created = new Map()
  const oldestPush = new Map()
  const top = 1000
  let skip = 0
  let pages = 0
  const maxPages = 80

  while (pages < maxPages) {
    const params = new URLSearchParams({
      includeRefUpdates: 'true',
      '$top': String(top),
      '$skip': String(skip),
      'api-version': API_VERSION,
    })
    const { json } = await adoFetch(
      `https://dev.azure.com/${org}/${projectId}/_apis/git/repositories/${repoId}/pushes?${params}`,
      pat,
    )
    const pushes = Array.isArray(json.value) ? json.value : []
    if (pushes.length === 0) break

    for (const push of pushes) {
      const pushDate = toDate(push.date)
      if (!pushDate) continue
      for (const update of push.refUpdates ?? []) {
        const branch = stripRef(update.name)
        if (!branch || !String(update.name || '').startsWith('refs/heads/')) continue

        const prevOldest = oldestPush.get(branch)
        oldestPush.set(branch, earlierDate(prevOldest, pushDate))

        if (String(update.oldObjectId || '').toLowerCase() === ZERO_OID) {
          const prevCreated = created.get(branch)
          created.set(branch, earlierDate(prevCreated, pushDate))
        }
      }
    }

    pages += 1
    if (pushes.length < top) break
    skip += top
  }

  for (const [branch, date] of oldestPush) {
    if (!created.has(branch)) created.set(branch, date)
  }

  return { created, truncated: pages >= maxPages }
}

function commitMessage(commit) {
  const comment = String(commit?.comment || commit?.commentTruncated || '').trim()
  return comment.replace(/\r\n/g, '\n').split('\n')[0].trim()
}

function commitDate(commit) {
  return (
    toDate(commit?.committer?.date) ||
    toDate(commit?.author?.date) ||
    toDate(commit?.push?.date) ||
    null
  )
}

function commitAuthor(commit) {
  return commit?.committer?.name || commit?.author?.name || ''
}

function buildBranchUrl(org, projectName, repoName, branchName) {
  const version = encodeURIComponent(`GB${branchName}`)
  return `https://dev.azure.com/${org}/${encodeURIComponent(projectName)}/_git/${encodeURIComponent(repoName)}?version=${version}`
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function excelSerial(date) {
  if (!date) return null
  return date.getTime() / 86400000 + 25569
}

function colLetter(index) {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function sheetXml(name, headers, rows, dateCols, widths) {
  const lastCol = colLetter(headers.length - 1)
  const lastRow = rows.length + 1
  const cols = widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join('')

  const cells = []
  for (let c = 0; c < headers.length; c += 1) {
    cells.push(
      `<c r="${colLetter(c)}1" t="inlineStr" s="1"><is><t>${xmlEscape(headers[c])}</t></is></c>`,
    )
  }
  let sheetData = `<row r="1">${cells.join('')}</row>`

  rows.forEach((row, rowIndex) => {
    const r = rowIndex + 2
    const xml = row
      .map((value, c) => {
        const ref = `${colLetter(c)}${r}`
        if (dateCols.has(c) && value instanceof Date) {
          return `<c r="${ref}" s="2"><v>${excelSerial(value)}</v></c>`
        }
        if (typeof value === 'number') {
          return `<c r="${ref}"><v>${value}</v></c>`
        }
        return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`
      })
      .join('')
    sheetData += `<row r="${r}">${xml}</row>`
  })

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr/>
  <dimension ref="A1:${lastCol}${lastRow}"/>
  <sheetViews><sheetView tabSelected="${name === 'Ramas' ? '1' : '0'}" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetData}</sheetData>
  <autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function zipXlsx(files) {
  const locals = []
  const centrals = []
  let offset = 0

  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8')
    const compressed = zlib.deflateRawSync(data)
    const crc = crc32(data)
    const nameBuf = Buffer.from(name, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    const localFull = Buffer.concat([local, nameBuf, compressed])
    locals.push(localFull)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(Buffer.concat([central, nameBuf]))
    offset += localFull.length
  }

  const centralDir = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralDir.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, centralDir, end])
}

async function inventoryRepo(org, pat, project, repo, index, total) {
  const label = `[${index + 1}/${total}] ${repo.name}`
  if (repo.isDisabled) {
    console.log(`${label}: deshabilitado, se omite detalle de ramas`)
    return { repo, branches: [], skipped: true, truncatedPushes: false }
  }

  console.log(`${label}: listando ramas...`)
  const [refs, stats] = await Promise.all([
    listBranchRefs(org, pat, project.id, repo.id),
    listBranchStats(org, pat, project.id, repo.id),
  ])

  const statsByName = new Map()
  for (const stat of stats) {
    const name = stripRef(stat.name)
    if (name) statsByName.set(name.toLowerCase(), stat)
  }

  const defaultBranch = stripRef(repo.defaultBranch)
  const tipIds = refs
    .map((ref) => ref.objectId)
    .filter(Boolean)

  const commitsById = await getCommitsByIds(
    org,
    pat,
    project.id,
    repo.id,
    tipIds,
  )

  console.log(`${label}: ${refs.length} ramas, buscando fechas de creación...`)
  const { created, truncated } = await getBranchCreationDates(
    org,
    pat,
    project.id,
    repo.id,
  )

  const branches = refs.map((ref) => {
    const rama = stripRef(ref.name)
    const stat = statsByName.get(rama.toLowerCase())
    const commit =
      commitsById.get(String(ref.objectId || '').toLowerCase()) ||
      stat?.commit ||
      null

    return {
      proyecto: repo.name,
      proyectoAzure: project.name,
      repositorio: repo.name,
      rama,
      ramaPorDefecto: defaultBranch && rama === defaultBranch ? 'Sí' : 'No',
      fechaCreacion: created.get(rama) || null,
      fechaActualizacion: commitDate(commit) || commitDate(stat?.commit),
      mensaje: commitMessage(commit) || commitMessage(stat?.commit),
      autor: commitAuthor(commit) || commitAuthor(stat?.commit),
      sha: ref.objectId || commit?.commitId || '',
      url: buildBranchUrl(org, project.name, repo.name, rama),
      deshabilitado: repo.isDisabled === true,
    }
  })

  console.log(`${label}: listo (${branches.length} ramas)`)
  return { repo, branches, skipped: false, truncatedPushes: truncated }
}

function writeExcel({ org, project, generatedAt, repoResults, rows }) {
  const ramaHeaders = [
    'Proyecto',
    'Nombre rama',
    'Fecha creación',
    'Fecha última actualización',
    'Mensaje del último commit',
    'Proyecto Azure DevOps',
    'Rama por defecto',
    'Autor último commit',
    'SHA commit',
    'URL rama',
  ]
  const ramaRows = rows.map((row) => [
    row.proyecto,
    row.rama,
    row.fechaCreacion,
    row.fechaActualizacion,
    row.mensaje,
    row.proyectoAzure,
    row.ramaPorDefecto,
    row.autor,
    row.sha,
    row.url,
  ])

  const resumenHeaders = [
    'Proyecto / Repositorio',
    'Rama por defecto',
    'Cantidad de ramas',
    'Última actualización',
    'Estado',
    'URL repositorio',
  ]
  const resumenRows = repoResults.map((result) => {
    const defaultBranch = stripRef(result.repo.defaultBranch)
    const lastUpdate = result.branches.reduce(
      (acc, branch) => laterDate(acc, branch.fechaActualizacion),
      null,
    )
    return [
      result.repo.name,
      defaultBranch,
      result.skipped ? 0 : result.branches.length,
      lastUpdate,
      result.repo.isDisabled ? 'Deshabilitado' : 'Activo',
      `https://dev.azure.com/${org}/${encodeURIComponent(project.name)}/_git/${encodeURIComponent(result.repo.name)}`,
    ]
  })

  const infoHeaders = ['Campo', 'Valor']
  const infoRows = [
    ['Organización Azure DevOps', org],
    ['Proyecto Azure DevOps', project.name],
    ['ID proyecto', project.id],
    ['Estado proyecto', project.state || ''],
    ['Generado', generatedAt],
    ['Archivo', OUTPUT_PATH],
    ['Repositorios Git', repoResults.length],
    ['Ramas listadas', rows.length],
    [
      'Fecha creación',
      'Primer push que creó la rama. Si el historial de pushes está recortado, se usa el push más antiguo disponible.',
    ],
    [
      'Fecha última actualización',
      'Fecha del committer del commit en la punta de la rama.',
    ],
    [
      'Uso para Aranda',
      'Cada repositorio Git de AFC corresponde a un proyecto guía. Cruce Nombre rama / Proyecto con el identificador del caso Aranda.',
    ],
  ]

  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Ramas" sheetId="1" r:id="rId1"/>
    <sheet name="Repositorios" sheetId="2" r:id="rId2"/>
    <sheet name="Info" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/></numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="3">
    <xf/>
    <xf fontId="1" applyFont="1"/>
    <xf numFmtId="164" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`,
    'xl/worksheets/sheet1.xml': sheetXml(
      'Ramas',
      ramaHeaders,
      ramaRows,
      new Set([2, 3]),
      [36, 42, 20, 24, 70, 22, 16, 28, 42, 70],
    ),
    'xl/worksheets/sheet2.xml': sheetXml(
      'Repositorios',
      resumenHeaders,
      resumenRows,
      new Set([3]),
      [40, 28, 18, 24, 16, 70],
    ),
    'xl/worksheets/sheet3.xml': sheetXml(
      'Info',
      infoHeaders,
      infoRows,
      new Set(),
      [28, 110],
    ),
  }

  fs.writeFileSync(OUTPUT_PATH, zipXlsx(files))
}

async function main() {
  const env = loadEnv(ENV_PATH)
  const org = (env.AZURE_DEVOPS_ORG || '').trim() || 'DA-AFP'
  const pat = (env.AZURE_DEVOPS_PAT || '').trim()
  if (!pat) {
    throw new Error('Falta AZURE_DEVOPS_PAT en D:\\React\\graficos-aranda\\.env')
  }

  console.log(`Organización: ${org}`)
  console.log(`Proyecto objetivo: ${PROJECT_NAME}`)

  const project = await getProject(org, pat, PROJECT_NAME)
  if (!project) {
    throw new Error(`No se encontró el proyecto Azure DevOps "${PROJECT_NAME}" en ${org}`)
  }

  console.log(`Proyecto encontrado: ${project.name} (${project.id})`)
  const repos = (await listRepositories(org, pat, project.id)).sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'es'),
  )
  console.log(`Repositorios Git: ${repos.length}`)

  const repoResults = await mapWithConcurrency(
    repos,
    REPO_CONCURRENCY,
    (repo, index) => inventoryRepo(org, pat, project, repo, index, repos.length),
  )

  const rows = repoResults
    .flatMap((result) => result.branches)
    .sort((a, b) => {
      const byProject = a.proyecto.localeCompare(b.proyecto, 'es')
      if (byProject !== 0) return byProject
      return a.rama.localeCompare(b.rama, 'es')
    })

  const generatedAt = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date())

  writeExcel({ org, project, generatedAt, repoResults, rows })

  const truncated = repoResults.filter((result) => result.truncatedPushes).length
  console.log(`EXCEL_OK=${OUTPUT_PATH}`)
  console.log(`REPOS=${repos.length}`)
  console.log(`RAMAS=${rows.length}`)
  console.log(`PUSHES_TRUNCATED_REPOS=${truncated}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

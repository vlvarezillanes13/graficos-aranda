import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const STORAGE_KEY = 'graficos:urgent-cases'
const FILE_STORE_PATH = fileURLToPath(
  new URL('../../.data/server-storage.json', import.meta.url),
)

const EMPTY_STATE = {
  urgentIds: [],
  actualizadoPor: null,
  actualizadoEn: null,
  version: 0,
  edicionBloqueada: true,
}

export class UrgentCasesEditLockedError extends Error {
  constructor() {
    super(
      'La actualización de casos urgentes está bloqueada por un administrador',
    )
    this.name = 'UrgentCasesEditLockedError'
  }
}

function kvConfig() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return {
      url: process.env.KV_REST_API_URL.replace(/\/$/, ''),
      token: process.env.KV_REST_API_TOKEN,
    }
  }

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      url: process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, ''),
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }
  }

  return null
}

function isEditLocked(value) {
  return value !== false
}

function normalizeUrgentIds(raw) {
  if (!Array.isArray(raw)) return []

  const seen = new Set()
  const normalized = []

  for (const value of raw) {
    const id = String(value ?? '')
      .trim()
      .toUpperCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }

  return normalized
}

function normalizeState(stored) {
  if (!stored || typeof stored !== 'object') {
    return { ...EMPTY_STATE }
  }

  return {
    urgentIds: normalizeUrgentIds(stored.urgentIds),
    actualizadoPor: stored.actualizadoPor ?? null,
    actualizadoEn: stored.actualizadoEn ?? null,
    version: typeof stored.version === 'number' ? stored.version : 0,
    edicionBloqueada: isEditLocked(stored.edicionBloqueada),
  }
}

function parseKvResult(result) {
  if (result == null) return null
  if (typeof result === 'string') {
    try {
      return JSON.parse(result)
    } catch {
      return null
    }
  }
  if (typeof result === 'object') return result
  return null
}

async function readFromKv() {
  const kv = kvConfig()
  if (!kv) return null

  const response = await fetch(`${kv.url}/get/${encodeURIComponent(STORAGE_KEY)}`, {
    headers: { Authorization: `Bearer ${kv.token}` },
  })
  if (!response.ok) return null

  const payload = await response.json().catch(() => null)
  return parseKvResult(payload?.result)
}

async function writeToKv(value) {
  const kv = kvConfig()
  if (!kv) return false

  const response = await fetch(
    `${kv.url}/set/${encodeURIComponent(STORAGE_KEY)}/${encodeURIComponent(JSON.stringify(value))}`,
    {
      headers: { Authorization: `Bearer ${kv.token}` },
    },
  )

  return response.ok
}

async function readFileStore() {
  try {
    const raw = await readFile(FILE_STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function writeFileStore(record) {
  await mkdir(dirname(FILE_STORE_PATH), { recursive: true })
  await writeFile(FILE_STORE_PATH, JSON.stringify(record), 'utf8')
}

async function readStoredState() {
  if (kvConfig()) {
    return readFromKv()
  }

  const record = await readFileStore()
  return record[STORAGE_KEY] ?? null
}

async function writeStoredState(next) {
  if (kvConfig()) {
    const saved = await writeToKv(next)
    if (!saved) {
      throw new Error('No se pudo guardar en el almacenamiento persistente')
    }
    return
  }

  const record = await readFileStore()
  record[STORAGE_KEY] = next
  await writeFileStore(record)
}

export async function getUrgentCasesState() {
  try {
    return normalizeState(await readStoredState())
  } catch (error) {
    console.error('[realtime] No se pudo leer urgentes persistidos:', error)
    return { ...EMPTY_STATE }
  }
}

export async function updateUrgentCasesState(urgentIds, usuario) {
  const current = await getUrgentCasesState()
  if (current.edicionBloqueada) {
    throw new UrgentCasesEditLockedError()
  }

  const next = {
    urgentIds: normalizeUrgentIds(urgentIds),
    actualizadoPor: String(usuario ?? '').trim() || 'Usuario',
    actualizadoEn: new Date().toISOString(),
    version: current.version + 1,
    edicionBloqueada: current.edicionBloqueada,
  }

  await writeStoredState(next)
  return next
}

export async function setUrgentCasesEditLock(edicionBloqueada, usuario) {
  const current = await getUrgentCasesState()
  const next = {
    ...current,
    edicionBloqueada: edicionBloqueada === true,
    actualizadoPor: String(usuario ?? '').trim() || 'Usuario',
    actualizadoEn: new Date().toISOString(),
    version: current.version + 1,
  }

  await writeStoredState(next)
  return next
}

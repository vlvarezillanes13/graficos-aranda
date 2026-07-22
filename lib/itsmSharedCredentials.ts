import {
  deleteStorageKey,
  readStorageJson,
  writeStorageJson,
} from './serverStorage.js'

const STORAGE_KEY = 'graficos:itsm-credentials'

export interface ItsmSharedCredentials {
  token: string
  cookie?: string
  updatedAt: number
  updatedBy?: string
}

let memoryCache: ItsmSharedCredentials | null = null

function normalizeBearerToken(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`
}

function normalizeCookie(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined
  const cookie = raw.split(';')[0]?.trim()
  if (!cookie) return undefined
  return cookie.includes('=') ? cookie : `AuthCookieASMS=${cookie}`
}

async function loadCredentials(): Promise<ItsmSharedCredentials | null> {
  if (memoryCache) return memoryCache

  const stored = await readStorageJson<ItsmSharedCredentials>(STORAGE_KEY)
  memoryCache = stored
  return stored
}

export async function hasItsmSharedCredentials(): Promise<boolean> {
  const credentials = await loadCredentials()
  return Boolean(credentials?.token)
}

export async function getItsmSharedToken(): Promise<string | undefined> {
  const credentials = await loadCredentials()
  return credentials?.token
}

export async function getItsmSharedCookie(): Promise<string | undefined> {
  const credentials = await loadCredentials()
  return credentials?.cookie
}

export async function getItsmSharedCredentialsMeta(): Promise<{
  configured: boolean
  updatedAt: number | null
  updatedBy: string | null
}> {
  const credentials = await loadCredentials()
  return {
    configured: Boolean(credentials?.token),
    updatedAt: credentials?.updatedAt ?? null,
    updatedBy: credentials?.updatedBy ?? null,
  }
}

export async function setItsmSharedCredentials(
  token: string,
  cookie?: string,
  updatedBy?: string,
): Promise<void> {
  const normalized = normalizeBearerToken(token)
  if (!normalized) {
    throw new Error('El token ITSM es obligatorio')
  }

  memoryCache = {
    token: normalized,
    cookie: normalizeCookie(cookie),
    updatedAt: Date.now(),
    updatedBy: updatedBy?.trim() || undefined,
  }

  await writeStorageJson(STORAGE_KEY, memoryCache)
}

export async function clearItsmSharedCredentials(): Promise<void> {
  memoryCache = null
  await deleteStorageKey(STORAGE_KEY)
}

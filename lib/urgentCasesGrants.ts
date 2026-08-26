import { sha256Hex } from './auth.js'
import { getAuthSessionSecret } from './env.js'
import { readStorageJson, writeStorageJson } from './serverStorage.js'

export const URGENT_UNLOCK_KEY_NAME = 'graficos:urgent-unlock-key'
const GRANTS_KEY = 'graficos:urgent-edit-grants'
const GRANT_TTL_MS = 8 * 60 * 60 * 1000
const SHA256_HEX = /^[a-f0-9]{64}$/i

interface StoredUnlockKey {
  claveHash: string
  actualizadoPor: string | null
  actualizadoEn: string | null
}

export class UrgentCasesKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrgentCasesKeyError'
  }
}

export class UrgentCasesSessionLockedError extends Error {
  constructor() {
    super(
      'Ingresa la clave en este equipo para actualizar urgentes. El desbloqueo no se comparte con otros equipos.',
    )
    this.name = 'UrgentCasesSessionLockedError'
  }
}

interface UrgentEditGrant {
  username: string
  createdAt: string
  expiresAt: number
}

type UrgentEditGrants = Record<string, UrgentEditGrant>

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return result === 0
}

async function fingerprintSession(token: string): Promise<string> {
  return sha256Hex(`${getAuthSessionSecret()}:${token}`)
}

function pruneGrants(grants: UrgentEditGrants, now = Date.now()): UrgentEditGrants {
  const next: UrgentEditGrants = {}
  for (const [key, grant] of Object.entries(grants)) {
    if (grant && grant.expiresAt > now) {
      next[key] = grant
    }
  }
  return next
}

async function readGrants(): Promise<UrgentEditGrants> {
  const stored = await readStorageJson<UrgentEditGrants>(GRANTS_KEY)
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return {}
  }
  return pruneGrants(stored)
}

async function writeGrants(grants: UrgentEditGrants): Promise<void> {
  await writeStorageJson(GRANTS_KEY, pruneGrants(grants))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

async function hashUnlockSecret(value: string): Promise<string> {
  const trimmed = value.trim()
  if (SHA256_HEX.test(trimmed)) return trimmed.toLowerCase()
  return (await sha256Hex(trimmed)).toLowerCase()
}

async function readStoredUnlockKeyHash(): Promise<string | null> {
  const stored = await readStorageJson<unknown>(URGENT_UNLOCK_KEY_NAME)
  if (typeof stored === 'string') {
    const trimmed = stored.trim()
    if (!trimmed) return null
    return await hashUnlockSecret(trimmed)
  }

  const record = asRecord(stored)
  if (!record) return null

  if (typeof record.claveHash === 'string' && record.claveHash.trim()) {
    return await hashUnlockSecret(record.claveHash)
  }

  if (typeof record.clave === 'string' && record.clave.trim()) {
    return await hashUnlockSecret(record.clave)
  }

  return null
}

export async function hasUrgentCasesUnlockKey(): Promise<boolean> {
  return Boolean(await readStoredUnlockKeyHash())
}

export async function setUrgentCasesUnlockKey(
  clave: string,
  usuario: string,
): Promise<void> {
  const trimmed = clave.trim()
  if (trimmed.length < 6 && !SHA256_HEX.test(trimmed)) {
    throw new UrgentCasesKeyError('La clave debe tener al menos 6 caracteres')
  }

  const next: StoredUnlockKey = {
    claveHash: await hashUnlockSecret(trimmed),
    actualizadoPor: usuario.trim() || 'Usuario',
    actualizadoEn: new Date().toISOString(),
  }

  await writeStorageJson(URGENT_UNLOCK_KEY_NAME, next)
  await revokeAllUrgentCasesGrants()
}

export async function unlockUrgentCasesSession(
  sessionToken: string | null | undefined,
  username: string,
  claveHash: string,
): Promise<void> {
  if (!sessionToken) {
    throw new UrgentCasesKeyError('Sesión no válida o expirada')
  }

  const expectedHash = await readStoredUnlockKeyHash()
  if (!expectedHash) {
    throw new UrgentCasesKeyError(
      'La clave de urgentes no está configurada en KV (graficos:urgent-unlock-key)',
    )
  }

  const provided = claveHash.trim().toLowerCase()
  if (!provided || !timingSafeEqual(provided, expectedHash)) {
    throw new UrgentCasesKeyError('Clave incorrecta')
  }

  const fingerprint = await fingerprintSession(sessionToken)
  const grants = await readGrants()
  const now = Date.now()
  grants[fingerprint] = {
    username: username.trim() || 'Usuario',
    createdAt: new Date(now).toISOString(),
    expiresAt: now + GRANT_TTL_MS,
  }
  await writeGrants(grants)
}

export async function revokeUrgentCasesSessionGrant(
  sessionToken: string | null | undefined,
): Promise<void> {
  if (!sessionToken) return

  const fingerprint = await fingerprintSession(sessionToken)
  const grants = await readGrants()
  if (!grants[fingerprint]) return
  delete grants[fingerprint]
  await writeGrants(grants)
}

export async function revokeAllUrgentCasesGrants(): Promise<void> {
  await writeGrants({})
}

export async function hasUrgentCasesSessionGrant(
  sessionToken: string | null | undefined,
): Promise<boolean> {
  if (!sessionToken) return false

  const fingerprint = await fingerprintSession(sessionToken)
  const grants = await readGrants()
  const grant = grants[fingerprint]
  if (!grant || grant.expiresAt <= Date.now()) {
    return false
  }

  return true
}

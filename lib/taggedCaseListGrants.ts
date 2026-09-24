import { sha256Hex } from './auth.js'
import { getAuthSessionSecret } from './env.js'
import { readStorageJson, writeStorageJson } from './serverStorage.js'
import {
  TAGGED_CASE_LISTS,
  type TaggedCaseKind,
  type TaggedCaseListConfig,
} from './taggedCaseListConfig.js'

const GRANT_TTL_MS = 8 * 60 * 60 * 1000
const SHA256_HEX = /^[a-f0-9]{64}$/i

interface StoredUnlockKey {
  claveHash: string
  actualizadoPor: string | null
  actualizadoEn: string | null
}

export class TaggedCasesKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaggedCasesKeyError'
  }
}

export class TaggedCasesSessionLockedError extends Error {
  constructor(label: string) {
    super(
      `Ingresa la clave en este equipo para actualizar ${label}. El desbloqueo no se comparte con otros equipos.`,
    )
    this.name = 'TaggedCasesSessionLockedError'
  }
}

interface TaggedEditGrant {
  username: string
  createdAt: string
  expiresAt: number
}

type TaggedEditGrants = Record<string, TaggedEditGrant>

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

function pruneGrants(grants: TaggedEditGrants, now = Date.now()): TaggedEditGrants {
  const next: TaggedEditGrants = {}
  for (const [key, grant] of Object.entries(grants)) {
    if (grant && grant.expiresAt > now) {
      next[key] = grant
    }
  }
  return next
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

function configOf(kind: TaggedCaseKind): TaggedCaseListConfig {
  return TAGGED_CASE_LISTS[kind]
}

async function readGrants(kind: TaggedCaseKind): Promise<TaggedEditGrants> {
  const stored = await readStorageJson<TaggedEditGrants>(configOf(kind).grantsKey)
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return {}
  }
  return pruneGrants(stored)
}

async function writeGrants(
  kind: TaggedCaseKind,
  grants: TaggedEditGrants,
): Promise<void> {
  await writeStorageJson(configOf(kind).grantsKey, pruneGrants(grants))
}

async function readStoredUnlockKeyHash(kind: TaggedCaseKind): Promise<string | null> {
  const stored = await readStorageJson<unknown>(configOf(kind).unlockKeyName)
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

export async function hasTaggedCasesUnlockKey(
  kind: TaggedCaseKind,
): Promise<boolean> {
  return Boolean(await readStoredUnlockKeyHash(kind))
}

export async function setTaggedCasesUnlockKey(
  kind: TaggedCaseKind,
  clave: string,
  usuario: string,
): Promise<void> {
  const trimmed = clave.trim()
  if (trimmed.length < 6 && !SHA256_HEX.test(trimmed)) {
    throw new TaggedCasesKeyError('La clave debe tener al menos 6 caracteres')
  }

  const next: StoredUnlockKey = {
    claveHash: await hashUnlockSecret(trimmed),
    actualizadoPor: usuario.trim() || 'Usuario',
    actualizadoEn: new Date().toISOString(),
  }

  await writeStorageJson(configOf(kind).unlockKeyName, next)
  await revokeAllTaggedCasesGrants(kind)
}

export async function unlockTaggedCasesSession(
  kind: TaggedCaseKind,
  sessionToken: string | null | undefined,
  username: string,
  claveHash: string,
): Promise<void> {
  if (!sessionToken) {
    throw new TaggedCasesKeyError('Sesión no válida o expirada')
  }

  const expectedHash = await readStoredUnlockKeyHash(kind)
  if (!expectedHash) {
    throw new TaggedCasesKeyError(
      `La clave de ${configOf(kind).label} no está configurada en KV (${configOf(kind).unlockKeyName})`,
    )
  }

  const provided = claveHash.trim().toLowerCase()
  if (!provided || !timingSafeEqual(provided, expectedHash)) {
    throw new TaggedCasesKeyError('Clave incorrecta')
  }

  const fingerprint = await fingerprintSession(sessionToken)
  const grants = await readGrants(kind)
  const now = Date.now()
  grants[fingerprint] = {
    username: username.trim() || 'Usuario',
    createdAt: new Date(now).toISOString(),
    expiresAt: now + GRANT_TTL_MS,
  }
  await writeGrants(kind, grants)
}

export async function revokeTaggedCasesSessionGrant(
  kind: TaggedCaseKind,
  sessionToken: string | null | undefined,
): Promise<void> {
  if (!sessionToken) return

  const fingerprint = await fingerprintSession(sessionToken)
  const grants = await readGrants(kind)
  if (!grants[fingerprint]) return
  delete grants[fingerprint]
  await writeGrants(kind, grants)
}

export async function revokeAllTaggedCasesGrants(
  kind: TaggedCaseKind,
): Promise<void> {
  await writeGrants(kind, {})
}

export async function hasTaggedCasesSessionGrant(
  kind: TaggedCaseKind,
  sessionToken: string | null | undefined,
): Promise<boolean> {
  if (!sessionToken) return false

  const fingerprint = await fingerprintSession(sessionToken)
  const grants = await readGrants(kind)
  const grant = grants[fingerprint]
  if (!grant || grant.expiresAt <= Date.now()) {
    return false
  }

  return true
}

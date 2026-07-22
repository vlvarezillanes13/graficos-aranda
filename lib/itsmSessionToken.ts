import {
  formatItsmBearerToken,
  getItsmIntegrationToken,
  ITSM_BOOTSTRAP_ERROR,
} from './env.js'

const ITSM_ORIGIN = 'https://itsm.sonda.com'
const ITSM_REFERER = `${ITSM_ORIGIN}/asmsspecialist/index.html`
const CREATE_TOKEN_URL = `${ITSM_ORIGIN}/asmsconsole/api/v9/authentication/create/token`
const REFRESH_BUFFER_MS = 5 * 60 * 1000
const DEFAULT_TTL_MS = 55 * 60 * 1000
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/

interface TokenCache {
  token: string
  expiresAt: number
}

let cache: TokenCache | null = null
let inflightRefresh: Promise<string> | null = null

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding =
    normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))

  return Buffer.from(normalized + padding, 'base64').toString('utf8')
}

function normalizeToken(token: string): string {
  const trimmed = token.trim()
  const jwt = trimmed.match(JWT_PATTERN)?.[0]
  return jwt ?? trimmed.replace(/^Bearer\s+/i, '').trim()
}

function parseJwtExpiration(token: string): number | null {
  try {
    const payloadPart = normalizeToken(token).split('.')[1]
    if (!payloadPart) return null

    const payload = JSON.parse(decodeBase64Url(payloadPart)) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function parseTokenFromResponse(payload: unknown, depth = 0): string | null {
  if (depth > 6) return null

  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    if (!trimmed) return null

    const jwt = trimmed.match(JWT_PATTERN)?.[0]
    return jwt ?? trimmed
  }

  if (!payload || typeof payload !== 'object') {
    return null
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const token = parseTokenFromResponse(item, depth + 1)
      if (token) return token
    }
    return null
  }

  const record = payload as Record<string, unknown>

  for (const key of [
    'token',
    'accessToken',
    'access_token',
    'sessionToken',
    'value',
  ]) {
    if (typeof record[key] === 'string' && record[key].trim()) {
      return parseTokenFromResponse(record[key], depth + 1)
    }
  }

  if (record.content !== undefined) {
    const contentToken = parseTokenFromResponse(record.content, depth + 1)
    if (contentToken) return contentToken
  }

  for (const value of Object.values(record)) {
    const token = parseTokenFromResponse(value, depth + 1)
    if (token) return token
  }

  return null
}

function buildBootstrapHeaders(): Record<string, string> {
  const integrationToken = getItsmIntegrationToken()

  if (!integrationToken) {
    throw new Error(ITSM_BOOTSTRAP_ERROR)
  }

  return {
    Accept: 'application/json, text/plain, */*',
    Origin: ITSM_ORIGIN,
    Referer: ITSM_REFERER,
    'X-Authorization': formatItsmBearerToken(integrationToken),
  }
}

function storeToken(token: string): string {
  const normalized = normalizeToken(token)
  const expiresAt = parseJwtExpiration(normalized) ?? Date.now() + DEFAULT_TTL_MS
  cache = { token: normalized, expiresAt }
  return normalized
}

function storeIntegrationTokenFallback(): string {
  const integrationToken = getItsmIntegrationToken()
  if (!integrationToken) {
    throw new Error(ITSM_BOOTSTRAP_ERROR)
  }

  return storeToken(integrationToken)
}

function hasValidCachedToken(): boolean {
  return Boolean(cache && cache.expiresAt - REFRESH_BUFFER_MS > Date.now())
}

export function getCachedItsmSessionToken(): string | undefined {
  if (!hasValidCachedToken() || !cache) return undefined
  return cache.token
}

function formatUpstreamError(body: string, status: number): string {
  const trimmed = body.trim()
  if (!trimmed) {
    return `No se pudo crear token ITSM (${status})`
  }

  if (trimmed.startsWith('<')) {
    const methodMatch = trimmed.match(/<p>([^<]+)<\/p>/i)
    if (methodMatch?.[1]) {
      return `${methodMatch[1].trim()} (${status})`
    }
    return `Error ITSM (${status})`
  }

  return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed
}

export async function refreshItsmSessionToken(): Promise<string> {
  if (inflightRefresh) {
    return inflightRefresh
  }

  inflightRefresh = (async () => {
    const response = await fetch(CREATE_TOKEN_URL, {
      method: 'GET',
      headers: buildBootstrapHeaders(),
    })

    const body = await response.text()

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return storeIntegrationTokenFallback()
      }

      throw new Error(formatUpstreamError(body, response.status))
    }

    let payload: unknown = body
    if (body.trim()) {
      try {
        payload = JSON.parse(body)
      } catch {
        payload = body
      }
    }

    const token = parseTokenFromResponse(payload)
    if (token) {
      return storeToken(token)
    }

    return storeIntegrationTokenFallback()
  })().finally(() => {
    inflightRefresh = null
  })

  return inflightRefresh
}

export async function getItsmSessionToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && hasValidCachedToken() && cache) {
    return cache.token
  }

  return refreshItsmSessionToken()
}

export function clearItsmSessionTokenCache(): void {
  cache = null
}

export async function warmItsmSessionToken(): Promise<void> {
  await getItsmSessionToken()
}

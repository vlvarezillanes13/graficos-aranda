export interface ItsmSharedCredentials {
  token: string
  cookie?: string
  updatedAt: number
  updatedBy?: string
}

let shared: ItsmSharedCredentials | null = null

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

export function hasItsmSharedCredentials(): boolean {
  return Boolean(shared?.token)
}

export function getItsmSharedToken(): string | undefined {
  return shared?.token
}

export function getItsmSharedCookie(): string | undefined {
  return shared?.cookie
}

export function getItsmSharedCredentialsMeta(): {
  configured: boolean
  updatedAt: number | null
  updatedBy: string | null
} {
  return {
    configured: hasItsmSharedCredentials(),
    updatedAt: shared?.updatedAt ?? null,
    updatedBy: shared?.updatedBy ?? null,
  }
}

export function setItsmSharedCredentials(
  token: string,
  cookie?: string,
  updatedBy?: string,
): void {
  const normalized = normalizeBearerToken(token)
  if (!normalized) {
    throw new Error('El token ITSM es obligatorio')
  }

  shared = {
    token: normalized,
    cookie: normalizeCookie(cookie),
    updatedAt: Date.now(),
    updatedBy: updatedBy?.trim() || undefined,
  }
}

export function clearItsmSharedCredentials(): void {
  shared = null
}

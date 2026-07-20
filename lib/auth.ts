export const AUTH_USERNAME = 'SNDTEST'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

export interface LoginRequest {
  username: string
  passwordHash: string
}

export interface LoginResponse {
  token: string
  expiresAt: number
  username: string
}

function getSessionSecret(): string {
  const secret =
    process.env.VITE_AUTH_SESSION_SECRET ?? 'dev-only-change-in-production'

  return secret
}

export function buildDailyPassword(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `SND${day}${month}`
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  )

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return result === 0
}

export async function verifyCredentials(
  username: string,
  passwordHash: string,
): Promise<boolean> {
  if (username.trim().toUpperCase() !== AUTH_USERNAME) {
    return false
  }

  const expectedHash = await sha256Hex(buildDailyPassword())
  return timingSafeEqual(passwordHash.toLowerCase(), expectedHash.toLowerCase())
}

export async function createSessionToken(
  username: string,
): Promise<LoginResponse> {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const payload = JSON.stringify({ u: username, exp: expiresAt })
  const payloadB64 = btoa(payload)
  const signature = await hmacSha256Hex(getSessionSecret(), payloadB64)

  return {
    token: `${payloadB64}.${signature}`,
    expiresAt,
    username,
  }
}

export async function verifySessionToken(
  token: string | null | undefined,
): Promise<string | null> {
  if (!token) return null

  const [payloadB64, signature] = token.split('.')
  if (!payloadB64 || !signature) return null

  const expectedSignature = await hmacSha256Hex(getSessionSecret(), payloadB64)
  if (!timingSafeEqual(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(atob(payloadB64)) as { u?: string; exp?: number }
    if (!payload.u || !payload.exp || payload.exp < Date.now()) {
      return null
    }

    return payload.u
  } catch {
    return null
  }
}

export function extractBearerToken(
  authorization: string | null | undefined,
): string | null {
  if (!authorization?.startsWith('Bearer ')) return null
  return authorization.slice(7).trim() || null
}

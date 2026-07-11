import { sha256Hex } from '../utils/crypto'

const TOKEN_KEY = 'graficos_auth_token'
const USERNAME_KEY = 'graficos_auth_user'

export interface AuthSession {
  token: string
  username: string
  expiresAt: number
}

function saveSession(session: AuthSession): void {
  sessionStorage.setItem(TOKEN_KEY, session.token)
  sessionStorage.setItem(USERNAME_KEY, session.username)
  sessionStorage.setItem('graficos_auth_exp', String(session.expiresAt))
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USERNAME_KEY)
  sessionStorage.removeItem('graficos_auth_exp')
}

export function getSessionToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const expiresAt = Number(sessionStorage.getItem('graficos_auth_exp') ?? 0)

  if (!token || !expiresAt || expiresAt < Date.now()) {
    clearSession()
    return null
  }

  return token
}

export function getSessionUsername(): string | null {
  return sessionStorage.getItem(USERNAME_KEY)
}

export async function login(
  username: string,
  password: string,
): Promise<AuthSession> {
  const passwordHash = await sha256Hex(password)

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, passwordHash }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'No se pudo iniciar sesión',
    )
  }

  const session: AuthSession = {
    token: data.token,
    username: data.username,
    expiresAt: data.expiresAt,
  }

  saveSession(session)
  return session
}

export async function verifySession(): Promise<boolean> {
  const token = getSessionToken()
  if (!token) return false

  const response = await fetch('/api/auth/verify', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    clearSession()
    return false
  }

  return true
}

export function getAuthHeaders(): HeadersInit {
  const token = getSessionToken()
  if (!token) return {}

  return {
    Authorization: `Bearer ${token}`,
  }
}

export function logout(): void {
  clearSession()
}

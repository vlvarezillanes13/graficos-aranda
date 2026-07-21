function stripCookieValue(raw?: string): string | undefined {
  if (!raw) return undefined
  const cookie = raw.split(';')[0]?.trim()
  if (!cookie) return undefined
  return cookie.includes('=') ? cookie : `AuthCookieASMS=${cookie}`
}

/** Server-only: prefer non-VITE vars (Vercel). VITE_* is a local dev fallback. */
export function getItsmAuthToken(): string | undefined {
  return (
    process.env.ITSM_AUTH_TOKEN ??
    process.env.VITE_ITSM_AUTH_TOKEN
  )?.trim()
}

/** Server-only: prefer non-VITE vars (Vercel). VITE_* is a local dev fallback. */
export function getItsmAuthCookie(): string | undefined {
  const raw =
    process.env.ITSM_AUTH_COOKIE ?? process.env.VITE_ITSM_AUTH_COOKIE

  return stripCookieValue(raw)
}

/** Default admin password for SNDVAI (assignment privileges). */
export const DEFAULT_AUTH_ADMIN_PASSWORD = 'SND2109'

/** Server-only admin password for assignment privileges. */
export function getAuthAdminPassword(): string {
  return (
    process.env.AUTH_ADMIN_PASSWORD ??
    process.env.VITE_AUTH_ADMIN_PASSWORD ??
    DEFAULT_AUTH_ADMIN_PASSWORD
  ).trim()
}

/** Server-only session signing secret. */
export function getAuthSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ??
    process.env.VITE_AUTH_SESSION_SECRET ??
    'dev-only-change-in-production'
  )
}

export function resolveItsmAuthTokenFromEnv(
  env: Record<string, string>,
): string | undefined {
  return (env.ITSM_AUTH_TOKEN ?? env.VITE_ITSM_AUTH_TOKEN)?.trim()
}

export function resolveItsmAuthCookieFromEnv(
  env: Record<string, string>,
): string | undefined {
  return stripCookieValue(env.ITSM_AUTH_COOKIE ?? env.VITE_ITSM_AUTH_COOKIE)
}

export function formatItsmBearerToken(token: string): string {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

export const ITSM_AUTH_TOKEN_ERROR =
  'Configura ITSM_AUTH_TOKEN en Vercel (o VITE_ITSM_AUTH_TOKEN en local) y haz redeploy.'

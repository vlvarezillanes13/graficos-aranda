/** Bootstrap token used only to create ITSM session tokens. */
export function getItsmIntegrationToken(): string | undefined {
  return (
    process.env.ITSM_INTEGRATION_TOKEN ??
    process.env.ITSM_AUTH_TOKEN ??
    process.env.VITE_ITSM_INTEGRATION_TOKEN ??
    process.env.VITE_ITSM_AUTH_TOKEN
  )?.trim()
}

/** @deprecated Session token is fetched dynamically. Use getItsmIntegrationToken(). */
export function getItsmAuthToken(): string | undefined {
  return getItsmIntegrationToken()
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

export function resolveItsmIntegrationTokenFromEnv(
  env: Record<string, string>,
): string | undefined {
  return (
    env.ITSM_INTEGRATION_TOKEN ??
    env.ITSM_AUTH_TOKEN ??
    env.VITE_ITSM_INTEGRATION_TOKEN ??
    env.VITE_ITSM_AUTH_TOKEN
  )?.trim()
}

export function resolveItsmAuthTokenFromEnv(
  env: Record<string, string>,
): string | undefined {
  return resolveItsmIntegrationTokenFromEnv(env)
}

export function formatItsmBearerToken(token: string): string {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

export const ITSM_BOOTSTRAP_ERROR =
  'Configura ITSM_INTEGRATION_TOKEN para autenticar con ITSM.'

export const ITSM_AUTH_TOKEN_ERROR = ITSM_BOOTSTRAP_ERROR

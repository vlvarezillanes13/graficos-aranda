/** Server-only session signing secret and app auth helpers. */
export const DEFAULT_AUTH_ADMIN_PASSWORD = 'SND2109'

export function getAuthAdminPassword(): string {
  return (
    process.env.AUTH_ADMIN_PASSWORD ??
    process.env.VITE_AUTH_ADMIN_PASSWORD ??
    DEFAULT_AUTH_ADMIN_PASSWORD
  ).trim()
}

export function getAuthSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ??
    process.env.VITE_AUTH_SESSION_SECRET ??
    'dev-only-change-in-production'
  )
}

export function resolveAuthSessionSecretFromEnv(
  env: Record<string, string>,
): string | undefined {
  return (
    env.AUTH_SESSION_SECRET ??
    env.VITE_AUTH_SESSION_SECRET
  )?.trim()
}

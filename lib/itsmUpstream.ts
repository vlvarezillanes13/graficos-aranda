import {
  buildAdditionalFieldsUrl,
  buildFileUrl,
  buildItemFilesUrl,
  buildItemHistoryUrl,
  buildItsmSearchUrl,
  buildItsmHeaders,
  ITSM_ORIGIN,
  ITSM_REFERER,
  requireSession,
  requireSessionFromAuthHeader,
  requireAdminSessionFromAuthHeader,
} from './itsmApi.js'
import {
  resolveAuthSessionSecretFromEnv,
} from './env.js'

export {
  buildAdditionalFieldsUrl,
  buildFileUrl,
  buildItemFilesUrl,
  buildItemHistoryUrl,
  buildItsmSearchUrl,
  buildItsmHeaders,
  ITSM_ORIGIN,
  ITSM_REFERER,
  requireSession,
  requireSessionFromAuthHeader,
  requireAdminSessionFromAuthHeader,
}

export function configureDevServerEnv(env: Record<string, string>): void {
  const authSecret = resolveAuthSessionSecretFromEnv(env)
  if (authSecret) {
    process.env.AUTH_SESSION_SECRET = authSecret
    process.env.VITE_AUTH_SESSION_SECRET = authSecret
  }
}

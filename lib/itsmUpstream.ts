import {
  buildAdditionalFieldsUrl,
  buildFileUrl,
  buildItemFilesUrl,
  buildItemHistoryUrl,
  buildItemUrl,
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
  buildItemUrl,
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

  if (env.AZURE_DEVOPS_PAT?.trim()) {
    process.env.AZURE_DEVOPS_PAT = env.AZURE_DEVOPS_PAT.trim().replace(
      /^["']|["']$/g,
      '',
    )
  }

  if (env.AZURE_DEVOPS_ORG?.trim()) {
    process.env.AZURE_DEVOPS_ORG = env.AZURE_DEVOPS_ORG.trim().replace(
      /^["']|["']$/g,
      '',
    )
  }
}

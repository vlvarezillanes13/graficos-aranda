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
  getItsmIntegrationToken as getProdItsmIntegrationToken,
} from './env.js'
import {
  getCachedItsmSessionToken,
  getItsmSessionToken,
  warmItsmSessionToken,
} from './itsmSessionToken.js'

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
  getCachedItsmSessionToken,
  getItsmSessionToken,
  warmItsmSessionToken,
}

interface ItsmRuntimeEnv {
  integrationToken?: string
}

let runtimeEnv: ItsmRuntimeEnv | null = null

export function configureItsmRuntimeEnv(env: ItsmRuntimeEnv): void {
  runtimeEnv = {
    integrationToken: env.integrationToken?.trim(),
  }

  if (runtimeEnv.integrationToken) {
    process.env.ITSM_INTEGRATION_TOKEN = runtimeEnv.integrationToken
  }
}

export function getItsmIntegrationToken(): string | undefined {
  return runtimeEnv?.integrationToken ?? getProdItsmIntegrationToken()
}

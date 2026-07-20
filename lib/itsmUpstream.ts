import {
  buildAdditionalFieldsUrl,
  buildFileUrl,
  buildItemFilesUrl,
  buildItemHistoryUrl,
  buildItsmHeaders,
  getItsmAuthCookie as getProdItsmAuthCookie,
  getItsmAuthToken as getProdItsmAuthToken,
  ITSM_ORIGIN,
  ITSM_REFERER,
  requireSession,
  requireSessionFromAuthHeader,
} from './itsmApi.js'

export {
  buildAdditionalFieldsUrl,
  buildFileUrl,
  buildItemFilesUrl,
  buildItemHistoryUrl,
  buildItsmHeaders,
  ITSM_ORIGIN,
  ITSM_REFERER,
  requireSession,
  requireSessionFromAuthHeader,
}

interface ItsmRuntimeEnv {
  token?: string
  cookie?: string
}

let runtimeEnv: ItsmRuntimeEnv | null = null

function stripCookieValue(raw?: string): string | undefined {
  if (!raw) return undefined
  const cookie = raw.split(';')[0]?.trim()
  if (!cookie) return undefined
  return cookie.includes('=') ? cookie : `AuthCookieASMS=${cookie}`
}

export function configureItsmRuntimeEnv(env: ItsmRuntimeEnv): void {
  runtimeEnv = {
    token: env.token?.trim(),
    cookie: stripCookieValue(env.cookie),
  }
}

export function getItsmAuthToken(): string | undefined {
  return (
    runtimeEnv?.token ??
    getProdItsmAuthToken()
  )
}

export function getItsmAuthCookie(): string | undefined {
  return (
    runtimeEnv?.cookie ??
    getProdItsmAuthCookie()
  )
}

export function buildItsmDevHeaders(
  contentType = 'application/json',
): Record<string, string> {
  const token = getItsmAuthToken()
  if (!token) {
    throw new Error('ITSM_AUTH_TOKEN no configurado')
  }

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    Origin: ITSM_ORIGIN,
    Referer: ITSM_REFERER,
    'x-authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  }

  if (contentType) {
    headers['Content-Type'] = contentType
  }

  const cookie = getItsmAuthCookie()
  if (cookie) {
    headers.Cookie = cookie
  }

  return headers
}

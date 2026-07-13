import { extractBearerToken, verifySessionToken } from './auth.js'

export const ITSM_ORIGIN = 'https://itsm.sonda.com'
export const ITSM_REFERER = `${ITSM_ORIGIN}/asmsspecialist/index.html`

function stripCookieValue(raw?: string): string | undefined {
  if (!raw) return undefined
  const cookie = raw.split(';')[0]?.trim()
  if (!cookie) return undefined
  return cookie.includes('=') ? cookie : `AuthCookieASMS=${cookie}`
}

export function getItsmAuthToken(): string | undefined {
  return (
    process.env.ITSM_AUTH_TOKEN ?? process.env.VITE_ITSM_AUTH_TOKEN
  )?.trim()
}

export function getItsmAuthCookie(): string | undefined {
  const raw =
    stripCookieValue(process.env.ITSM_AUTH_COOKIE) ??
    stripCookieValue(process.env.VITE_ITSM_AUTH_COOKIE)

  return raw
}

export function buildItsmHeaders(
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

export async function requireSession(
  request: Request,
): Promise<string | Response> {
  const sessionToken = extractBearerToken(request.headers.get('Authorization'))
  const user = await verifySessionToken(sessionToken)

  if (!user) {
    return Response.json(
      { error: 'Sesión no válida o expirada' },
      { status: 401 },
    )
  }

  return user
}

export async function requireSessionFromAuthHeader(
  authorization: string | undefined,
): Promise<string | null> {
  const sessionToken = extractBearerToken(authorization)
  return verifySessionToken(sessionToken)
}

export function buildItemFilesUrl(itemId: string, itemType: string): string {
  const params = new URLSearchParams({
    itemType,
    uploadType: '0',
    additionalFieldId: '',
    validate: 'true',
  })

  return `${ITSM_ORIGIN}/asmsconsole/api/v9/item/${itemId}/files?${params}`
}

export function buildFileUrl(fileId: string): string {
  return `${ITSM_ORIGIN}/asmsconsole/api/v9/file/${fileId}`
}

export function resolveFileContentType(
  upstreamType: string | null,
  fileName?: string,
): string {
  const normalized = upstreamType?.split(';')[0]?.trim().toLowerCase() ?? ''

  if (
    normalized &&
    normalized !== 'application/octet-stream' &&
    normalized !== 'binary/octet-stream'
  ) {
    return normalized
  }

  if (!fileName) {
    return normalized || 'application/octet-stream'
  }

  const extension = fileName.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'pdf':
      return 'application/pdf'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'txt':
      return 'text/plain'
    default:
      return normalized || 'application/octet-stream'
  }
}

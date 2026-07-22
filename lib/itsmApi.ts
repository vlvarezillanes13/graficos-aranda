import {
  extractBearerToken,
  verifySessionToken,
  type SessionInfo,
} from './auth.js'
import {
  ITSM_BOOTSTRAP_ERROR,
} from './env.js'
import { getItsmSessionToken } from './itsmSessionToken.js'

export {
  getItsmIntegrationToken,
  ITSM_BOOTSTRAP_ERROR,
} from './env.js'

export const ITSM_ORIGIN = 'https://itsm.sonda.com'
export const ITSM_REFERER = `${ITSM_ORIGIN}/asmsspecialist/index.html`

export async function buildItsmHeaders(
  contentType = 'application/json',
  forceRefresh = false,
): Promise<Record<string, string>> {
  const token = await getItsmSessionToken(forceRefresh)

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    Origin: ITSM_ORIGIN,
    Referer: ITSM_REFERER,
    'x-authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  }

  if (contentType) {
    headers['Content-Type'] = contentType
  }

  return headers
}

export type { SessionInfo } from './auth.js'

export async function requireSession(
  request: Request,
): Promise<SessionInfo | Response> {
  const sessionToken = extractBearerToken(request.headers.get('Authorization'))
  const session = await verifySessionToken(sessionToken)

  if (!session) {
    return Response.json(
      { error: 'Sesión no válida o expirada' },
      { status: 401 },
    )
  }

  return session
}

export async function requireSessionFromAuthHeader(
  authorization: string | undefined,
): Promise<SessionInfo | null> {
  const sessionToken = extractBearerToken(authorization)
  return verifySessionToken(sessionToken)
}

export async function requireAdminSessionFromAuthHeader(
  authorization: string | undefined,
): Promise<SessionInfo | null> {
  const session = await requireSessionFromAuthHeader(authorization)
  if (!session?.isAdmin) return null
  return session
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

export interface ItemHistoryParams {
  isClosed: boolean
  modelId: number
  statusId: number
  consoleType?: number
  limitDescription?: boolean
}

export function buildItemHistoryUrl(
  itemId: string,
  historyParams: ItemHistoryParams,
): string {
  const params = new URLSearchParams({
    isClosed: String(historyParams.isClosed),
    consoleType: String(historyParams.consoleType ?? 1),
    modelId: String(historyParams.modelId),
    statusId: String(historyParams.statusId),
    limitDescription: String(historyParams.limitDescription ?? false),
  })

  return `${ITSM_ORIGIN}/asmsconsole/api/v9/item/${itemId}/history/list?${params}`
}

export function buildFileUrl(fileId: string): string {
  return `${ITSM_ORIGIN}/asmsconsole/api/v9/file/${fileId}`
}

export function buildAdditionalFieldsUrl(): string {
  return `${ITSM_ORIGIN}/asmsconsole/api/v9/item/additionalfields`
}

export function buildItsmSearchUrl(): string {
  return `${ITSM_ORIGIN}/asmsconsole/api/v9/item/search?language=0`
}

export function buildItemUrl(itemId: string): string {
  return `${ITSM_ORIGIN}/asmsconsole/api/v9/item/${itemId}`
}

export function buildGroupListUrl(serviceId: number, stateId: number): string {
  return `${ITSM_ORIGIN}/asmsconsole/api/v9/service/${serviceId}/state/${stateId}/group/list`
}

export function buildGroupSpecialistsUrl(
  groupId: number,
  projectId: number,
): string {
  const params = new URLSearchParams({ available: 'true' })
  return `${ITSM_ORIGIN}/asmsconsole/api/v9/group/${groupId}/project/${projectId}/specialists?${params}`
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

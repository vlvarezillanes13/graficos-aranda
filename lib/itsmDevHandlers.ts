import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  buildAdditionalFieldsUrl,
  buildFileUrl,
  buildItemFilesUrl,
  buildItemHistoryUrl,
  buildItsmDevHeaders,
  requireSessionFromAuthHeader,
  requireAdminSessionFromAuthHeader,
} from './itsmUpstream.js'
import {
  assignItemResponsible,
  fetchItsmGroupSpecialists,
  fetchItsmGroups,
  type ItemAssignContext,
} from './assignResponsible.js'
import { resolveFileContentType } from './itsmApi.js'

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const raw = await readRequestBody(request)
  return raw ? (JSON.parse(raw) as T) : ({} as T)
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf8')
}

async function proxyJsonPost(
  request: IncomingMessage,
  response: ServerResponse,
  targetUrl: string,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(request.headers.authorization)
  if (!user) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada' })
    return
  }

  try {
    const body = await readRequestBody(request)
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: buildItsmDevHeaders(),
      body: body || '{}',
    })

    const responseBody = await upstream.text()
    response.statusCode = upstream.status
    response.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json',
    )
    response.end(responseBody)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    sendJson(response, 502, { error: message })
  }
}

async function proxyJsonGet(
  request: IncomingMessage,
  response: ServerResponse,
  targetUrl: string,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(request.headers.authorization)
  if (!user) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada' })
    return
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: buildItsmDevHeaders(''),
    })

    const body = await upstream.text()
    response.statusCode = upstream.status
    response.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json',
    )
    response.end(body)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    sendJson(response, 502, { error: message })
  }
}

async function proxyBinaryGet(
  request: IncomingMessage,
  response: ServerResponse,
  targetUrl: string,
  fileName?: string | null,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(request.headers.authorization)
  if (!user) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada' })
    return
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: buildItsmDevHeaders(''),
    })

    const buffer = Buffer.from(await upstream.arrayBuffer())
    const contentType = resolveFileContentType(
      upstream.headers.get('content-type'),
      fileName ?? undefined,
    )

    response.statusCode = upstream.status
    response.setHeader('Content-Type', contentType)

    const contentDisposition = upstream.headers.get('content-disposition')
    if (contentDisposition) {
      response.setHeader(
        'Content-Disposition',
        contentDisposition.replace(/attachment/i, 'inline'),
      )
    } else {
      response.setHeader('Content-Disposition', 'inline')
    }

    response.end(buffer)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    sendJson(response, 502, { error: message })
  }
}

export async function handleItsmAdditionalFields(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  await proxyJsonPost(request, response, buildAdditionalFieldsUrl())
}

export async function handleItsmItemFiles(
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const itemId = requestUrl.searchParams.get('itemId')
  const itemType = requestUrl.searchParams.get('itemType') ?? '1'

  if (!itemId) {
    sendJson(response, 400, { error: 'itemId es obligatorio' })
    return
  }

  await proxyJsonGet(request, response, buildItemFilesUrl(itemId, itemType))
}

export async function handleItsmItemHistory(
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const itemId = requestUrl.searchParams.get('itemId')
  const isClosed = requestUrl.searchParams.get('isClosed') === 'true'
  const modelId = Number(requestUrl.searchParams.get('modelId'))
  const statusId = Number(requestUrl.searchParams.get('statusId'))

  if (!itemId || Number.isNaN(modelId) || Number.isNaN(statusId)) {
    sendJson(response, 400, {
      error: 'itemId, modelId y statusId son obligatorios',
    })
    return
  }

  await proxyJsonGet(
    request,
    response,
    buildItemHistoryUrl(itemId, { isClosed, modelId, statusId }),
  )
}

export async function handleItsmFile(
  request: IncomingMessage,
  response: ServerResponse,
  fileId: string,
  requestUrl: URL,
): Promise<void> {
  if (!fileId) {
    sendJson(response, 400, { error: 'fileId es obligatorio' })
    return
  }

  const fileName = requestUrl.searchParams.get('fileName')
  await proxyBinaryGet(request, response, buildFileUrl(fileId), fileName)
}

export async function handleItsmGroups(
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const session = await requireAdminSessionFromAuthHeader(
    request.headers.authorization,
  )
  if (!session) {
    sendJson(response, 403, {
      error: 'Se requiere acceso administrador para consultar grupos de asignación',
    })
    return
  }

  const serviceId = Number(requestUrl.searchParams.get('serviceId'))
  const stateId = Number(requestUrl.searchParams.get('stateId'))

  if (Number.isNaN(serviceId) || Number.isNaN(stateId)) {
    sendJson(response, 400, { error: 'serviceId y stateId son obligatorios' })
    return
  }

  try {
    const upstream = await fetchItsmGroups(serviceId, stateId)
    const body = await upstream.text()
    response.statusCode = upstream.status
    response.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json',
    )
    response.end(body)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    sendJson(response, 502, { error: message })
  }
}

export async function handleItsmGroupSpecialists(
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const session = await requireAdminSessionFromAuthHeader(
    request.headers.authorization,
  )
  if (!session) {
    sendJson(response, 403, {
      error: 'Se requiere acceso administrador para consultar responsables',
    })
    return
  }

  const groupId = Number(requestUrl.searchParams.get('groupId'))
  const projectId = Number(requestUrl.searchParams.get('projectId'))

  if (Number.isNaN(groupId) || Number.isNaN(projectId)) {
    sendJson(response, 400, { error: 'groupId y projectId son obligatorios' })
    return
  }

  try {
    const upstream = await fetchItsmGroupSpecialists(groupId, projectId)
    const body = await upstream.text()
    response.statusCode = upstream.status
    response.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json',
    )
    response.end(body)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    sendJson(response, 502, { error: message })
  }
}

interface AssignResponsibleBody {
  itemId?: number | string
  groupId?: number
  responsibleId?: number
  itemContext?: ItemAssignContext
}

function isValidAssignContext(value: unknown): value is ItemAssignContext {
  if (!value || typeof value !== 'object') return false

  const context = value as Record<string, unknown>
  const numericFields = [
    'id',
    'itemType',
    'modelId',
    'stateId',
    'categoryId',
    'serviceId',
    'projectId',
    'applicantId',
    'companyId',
    'customerId',
    'locationId',
    'reasonId',
    'registryTypeId',
  ]

  return numericFields.every(
    (field) => typeof context[field] === 'number' && !Number.isNaN(context[field]),
  )
}

export async function handleItsmAssignResponsible(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const session = await requireAdminSessionFromAuthHeader(
    request.headers.authorization,
  )
  if (!session) {
    sendJson(response, 403, {
      error: 'Se requiere acceso administrador para cambiar el responsable',
    })
    return
  }

  try {
    const body = await readJsonBody<AssignResponsibleBody>(request)
    const { itemId, groupId, responsibleId, itemContext } = body

    if (itemId === undefined || itemId === null || itemId === '') {
      sendJson(response, 400, { error: 'itemId es obligatorio' })
      return
    }

    if (typeof groupId !== 'number' || typeof responsibleId !== 'number') {
      sendJson(response, 400, {
        error: 'groupId y responsibleId son obligatorios',
      })
      return
    }

    if (!isValidAssignContext(itemContext)) {
      sendJson(response, 400, { error: 'itemContext es obligatorio' })
      return
    }

    await assignItemResponsible(
      String(itemId),
      groupId,
      responsibleId,
      itemContext,
    )
    sendJson(response, 200, { ok: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    sendJson(response, 502, { error: message })
  }
}

export function isProtectedItsmApi(pathname: string, method?: string): boolean {
  if (pathname === '/api/itsm-search' && method === 'POST') return true
  if (pathname === '/api/itsm-additionalfields' && method === 'POST') return true
  if (pathname === '/api/itsm-item-files' && method === 'GET') return true
  if (pathname === '/api/itsm-item-history' && method === 'GET') return true
  if (pathname === '/api/itsm-groups' && method === 'GET') return true
  if (pathname === '/api/itsm-group-specialists' && method === 'GET') return true
  if (pathname === '/api/itsm-assign-responsible' && method === 'POST') return true
  if (pathname.startsWith('/api/itsm-file/') && method === 'GET') return true
  return false
}

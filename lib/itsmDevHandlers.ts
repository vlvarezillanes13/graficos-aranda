import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  buildFileUrl,
  buildItemFilesUrl,
  buildItsmHeaders,
  requireSessionFromAuthHeader,
} from './itsmUpstream.js'

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
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
      headers: buildItsmHeaders(''),
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
): Promise<void> {
  const user = await requireSessionFromAuthHeader(request.headers.authorization)
  if (!user) {
    sendJson(response, 401, { error: 'Sesión no válida o expirada' })
    return
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: buildItsmHeaders(''),
    })

    const buffer = Buffer.from(await upstream.arrayBuffer())
    response.statusCode = upstream.status
    response.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/octet-stream',
    )

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

export async function handleItsmFile(
  request: IncomingMessage,
  response: ServerResponse,
  fileId: string,
): Promise<void> {
  if (!fileId) {
    sendJson(response, 400, { error: 'fileId es obligatorio' })
    return
  }

  await proxyBinaryGet(request, response, buildFileUrl(fileId))
}

export function isProtectedItsmApi(pathname: string, method?: string): boolean {
  if (pathname === '/api/itsm-search' && method === 'POST') return true
  if (pathname === '/api/itsm-item-files' && method === 'GET') return true
  if (pathname.startsWith('/api/itsm-file/') && method === 'GET') return true
  return false
}

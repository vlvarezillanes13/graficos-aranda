import {
  buildFileUrl,
  buildItsmHeaders,
  requireSession,
} from '../lib/itsmUpstream.js'

export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const session = await requireSession(request)
  if (session instanceof Response) return session

  const url = new URL(request.url)
  const fileId = url.pathname.split('/').pop()

  if (!fileId || fileId === 'itsm-file') {
    return Response.json({ error: 'fileId es obligatorio' }, { status: 400 })
  }

  try {
    const upstream = await fetch(buildFileUrl(fileId), {
      method: 'GET',
      headers: buildItsmHeaders(''),
    })

    const contentType =
      upstream.headers.get('content-type') ?? 'application/octet-stream'
    const contentDisposition = upstream.headers.get('content-disposition')

    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
    })

    if (contentDisposition) {
      headers.set(
        'Content-Disposition',
        contentDisposition.replace(/attachment/i, 'inline'),
      )
    } else {
      headers.set('Content-Disposition', 'inline')
    }

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    return Response.json({ error: message }, { status: 502 })
  }
}

import {
  buildItemFilesUrl,
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
  const itemId = url.searchParams.get('itemId')
  const itemType = url.searchParams.get('itemType') ?? '1'

  if (!itemId) {
    return Response.json({ error: 'itemId es obligatorio' }, { status: 400 })
  }

  try {
    const upstream = await fetch(buildItemFilesUrl(itemId, itemType), {
      method: 'GET',
      headers: buildItsmHeaders(''),
    })

    const body = await upstream.text()

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    return Response.json({ error: message }, { status: 502 })
  }
}

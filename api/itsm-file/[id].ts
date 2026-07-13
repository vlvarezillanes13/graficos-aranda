import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildFileUrl,
  buildItsmHeaders,
  requireSessionFromAuthHeader,
} from '../../lib/itsmUpstream.js'

function resolveFileContentType(
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await requireSessionFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida o expirada' })
    return
  }

  const fileId = typeof req.query.id === 'string' ? req.query.id : undefined
  const fileName =
    typeof req.query.fileName === 'string' ? req.query.fileName : undefined

  if (!fileId) {
    res.status(400).json({ error: 'fileId es obligatorio' })
    return
  }

  try {
    const upstream = await fetch(buildFileUrl(fileId), {
      method: 'GET',
      headers: buildItsmHeaders(''),
    })

    const buffer = Buffer.from(await upstream.arrayBuffer())
    const contentType = resolveFileContentType(
      upstream.headers.get('content-type'),
      fileName,
    )
    const contentDisposition = upstream.headers.get('content-disposition')

    res.status(upstream.status)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, max-age=300')

    if (contentDisposition) {
      res.setHeader(
        'Content-Disposition',
        contentDisposition.replace(/attachment/i, 'inline'),
      )
    } else {
      res.setHeader('Content-Disposition', 'inline')
    }

    res.end(buffer)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al conectar con ITSM'
    res.status(502).json({ error: message })
  }
}

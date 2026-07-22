import type { VercelResponse } from '@vercel/node'
import {
  assertItsmCredentialsConfigured,
  ItsmCredentialsMissingError,
  itsmTokenMissingPayload,
  mapUpstreamItsmResponse,
} from './itsmCredentialsResponse.js'

export async function finishItsmTextProxy(
  res: VercelResponse,
  upstream: Response,
): Promise<void> {
  const body = await upstream.text()
  const mapped = await mapUpstreamItsmResponse(upstream.status, body)
  if (mapped.handled) {
    res.status(mapped.status).json(mapped.payload)
    return
  }

  res.status(upstream.status)
  res.setHeader(
    'Content-Type',
    upstream.headers.get('content-type') ?? 'application/json',
  )
  res.end(body)
}

export function sendItsmCredentialsMissing(res: VercelResponse): void {
  res.status(401).json(itsmTokenMissingPayload())
}

export async function guardItsmCredentials(res: VercelResponse): Promise<boolean> {
  const credentials = await assertItsmCredentialsConfigured()
  if (!credentials.ok) {
    res.status(401).json(credentials.payload)
    return false
  }
  return true
}

export function handleItsmProxyError(res: VercelResponse, error: unknown): void {
  if (error instanceof ItsmCredentialsMissingError) {
    sendItsmCredentialsMissing(res)
    return
  }

  const message =
    error instanceof Error ? error.message : 'Error al conectar con ITSM'
  res.status(502).json({ error: message })
}

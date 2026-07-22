import { getAuthHeaders } from './authService'

export const ITSM_TOKEN_REQUIRED = 'ITSM_TOKEN_REQUIRED'

export class ItsmTokenRequiredError extends Error {
  readonly code = ITSM_TOKEN_REQUIRED

  constructor(message: string) {
    super(message)
    this.name = 'ItsmTokenRequiredError'
  }
}

let requestTokenHandler: ((message?: string) => void) | null = null

export function registerItsmTokenRequestHandler(
  handler: ((message?: string) => void) | null,
): void {
  requestTokenHandler = handler
}

async function readItsmErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({}))
  if (data && typeof data === 'object' && typeof data.error === 'string') {
    return data.error
  }
  return `Error ITSM (${response.status})`
}

function notifyTokenRequired(response: Response, data: unknown): void {
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  if (record.code === ITSM_TOKEN_REQUIRED || record.source === 'itsm') {
    const message = typeof record.error === 'string' ? record.error : undefined
    requestTokenHandler?.(message)
    throw new ItsmTokenRequiredError(message ?? 'Token ITSM requerido')
  }
}

export async function fetchItsmApi(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init.headers ?? {}),
    },
  })

  if (response.status === 401) {
    const data = await response.clone().json().catch(() => ({}))
    notifyTokenRequired(response, data)
  }

  return response
}

export async function ensureItsmApiOk(response: Response): Promise<Response> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      notifyTokenRequired(response, data)
    }
    throw new Error(await readItsmErrorMessage(response))
  }

  return response
}

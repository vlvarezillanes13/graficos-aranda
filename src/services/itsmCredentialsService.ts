import { getAuthHeaders } from './authService'

export interface ItsmCredentialsStatus {
  configured: boolean
  updatedAt: number | null
  updatedBy: string | null
}

export async function fetchItsmCredentialsStatus(): Promise<ItsmCredentialsStatus> {
  const response = await fetch('/api/itsm-credentials', {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error('No se pudo consultar el token ITSM')
  }

  return (await response.json()) as ItsmCredentialsStatus
}

export async function saveItsmCredentials(
  token: string,
  cookie?: string,
): Promise<ItsmCredentialsStatus> {
  const response = await fetch('/api/itsm-credentials', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, cookie: cookie?.trim() || undefined }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'No se pudo guardar el token ITSM',
    )
  }

  return data as ItsmCredentialsStatus
}

const ITSM_ORIGIN = 'https://itsm.sonda.com'
export const ITSM_SEARCH_URL = `${ITSM_ORIGIN}/asmsconsole/api/v9/item/search?language=0`

export function getAuthToken(): string | undefined {
  return process.env.ITSM_AUTH_TOKEN ?? process.env.VITE_ITSM_AUTH_TOKEN
}

export function getAuthCookie(): string | undefined {
  const raw = process.env.ITSM_AUTH_COOKIE ?? process.env.VITE_ITSM_AUTH_COOKIE
  if (!raw) return undefined
  return raw.split(';')[0]?.trim()
}

export function buildItsmHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (!token) {
    throw new Error(
      'Configura ITSM_AUTH_TOKEN en las variables de entorno de Vercel.',
    )
  }

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    Origin: ITSM_ORIGIN,
    Referer: `${ITSM_ORIGIN}/asmsspecialist/index.html`,
    'x-authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  }

  const cookie = getAuthCookie()
  if (cookie) {
    headers.Cookie = cookie
  }

  return headers
}

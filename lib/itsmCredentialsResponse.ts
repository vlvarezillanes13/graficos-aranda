import { clearItsmSharedCredentials, hasItsmSharedCredentials } from './itsmSharedCredentials.js'

export const ITSM_TOKEN_REQUIRED = 'ITSM_TOKEN_REQUIRED'

export function itsmTokenRequiredPayload(detail?: string) {
  return {
    error: 'Token ITSM inválido o expirado. Ingresa uno nuevo.',
    source: 'itsm' as const,
    code: ITSM_TOKEN_REQUIRED,
    ...(detail ? { detail: detail.slice(0, 200) } : {}),
  }
}

export function itsmTokenMissingPayload() {
  return {
    error: 'Configura el token ITSM para continuar.',
    source: 'itsm' as const,
    code: ITSM_TOKEN_REQUIRED,
  }
}

export class ItsmCredentialsMissingError extends Error {
  readonly code = ITSM_TOKEN_REQUIRED

  constructor() {
    super('Token ITSM no configurado')
    this.name = 'ItsmCredentialsMissingError'
  }
}

export function assertItsmCredentialsConfigured():
  | { ok: true }
  | { ok: false; payload: ReturnType<typeof itsmTokenMissingPayload> } {
  if (hasItsmSharedCredentials()) {
    return { ok: true }
  }

  return { ok: false, payload: itsmTokenMissingPayload() }
}

export function mapUpstreamItsmResponse(
  status: number,
  body: string,
):
  | { handled: true; status: 401; payload: ReturnType<typeof itsmTokenRequiredPayload> }
  | { handled: false; status: number; body: string } {
  if (status === 401) {
    clearItsmSharedCredentials()
    return {
      handled: true,
      status: 401,
      payload: itsmTokenRequiredPayload(body),
    }
  }

  return { handled: false, status, body }
}

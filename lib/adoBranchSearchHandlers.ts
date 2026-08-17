import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  isAzureDevOpsConfigured,
  searchAzureDevOpsBranches,
} from './azureDevOps.js'
import { requireAdminSessionFromAuthHeader } from './itsmApi.js'

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

export async function handleAdoBranchSearch(
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const session = await requireAdminSessionFromAuthHeader(
    request.headers.authorization,
  )
  if (!session) {
    sendJson(response, 403, {
      error: 'Se requiere acceso administrador para buscar ramas',
    })
    return
  }

  if (!isAzureDevOpsConfigured()) {
    sendJson(response, 503, {
      error:
        'Azure DevOps no está configurado. Define AZURE_DEVOPS_PAT en el servidor.',
    })
    return
  }

  const query = (
    requestUrl.searchParams.get('q') ??
    requestUrl.searchParams.get('rama') ??
    ''
  ).trim()

  if (query.length < 2) {
    sendJson(response, 400, {
      error: 'Indica al menos 2 caracteres para buscar la rama',
    })
    return
  }

  if (query.length > 120) {
    sendJson(response, 400, { error: 'La búsqueda es demasiado larga' })
    return
  }

  try {
    const result = await searchAzureDevOpsBranches(query)
    sendJson(response, 200, result)
  } catch (error) {
    sendJson(response, 502, {
      error:
        error instanceof Error
          ? error.message
          : 'No se pudo consultar Azure DevOps',
    })
  }
}

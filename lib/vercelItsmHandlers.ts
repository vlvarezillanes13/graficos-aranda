import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  assignItemResponsible,
  fetchItsmGroupSpecialists,
  fetchItsmGroups,
  fetchItsmItem,
  type ItemAssignContext,
} from './assignResponsible.js'
import {
  buildAdditionalFieldsUrl,
  buildFileUrl,
  buildItemFilesUrl,
  buildItemHistoryUrl,
  buildItsmSearchUrl,
  requireAdminSessionFromAuthHeader,
  requireSessionFromAuthHeader,
  resolveFileContentType,
} from './itsmApi.js'
import { itsmTokenRequiredPayload } from './itsmCredentialsResponse.js'
import { itsmFetch } from './itsmFetch.js'
import {
  getItsmSharedCredentialsMeta,
  setItsmSharedCredentials,
  clearItsmSharedCredentials,
} from './itsmSharedCredentials.js'
import {
  finishItsmTextProxy,
  guardItsmCredentials,
  handleItsmProxyError,
} from './itsmVercelProxy.js'

function pickString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isValidContext(value: unknown): value is ItemAssignContext {
  if (!value || typeof value !== 'object') return false

  const context = value as Record<string, unknown>
  const numericFields = [
    'id',
    'itemType',
    'modelId',
    'stateId',
    'categoryId',
    'serviceId',
    'projectId',
    'applicantId',
    'companyId',
    'customerId',
    'locationId',
    'reasonId',
    'registryTypeId',
  ]

  return numericFields.every(
    (field) => typeof context[field] === 'number' && !Number.isNaN(context[field]),
  )
}

async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
): Promise<boolean> {
  const user = await requireSessionFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida o expirada' })
    return false
  }
  return true
}

export async function handleVercelItsmCredentials(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const user = await requireSessionFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida o expirada', source: 'app' })
    return
  }

  if (req.method === 'GET') {
    res.status(200).json(await getItsmSharedCredentialsMeta())
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    const cookie =
      typeof req.body?.cookie === 'string' ? req.body.cookie : undefined

    if (!token) {
      res.status(400).json({ error: 'token es obligatorio' })
      return
    }

    await setItsmSharedCredentials(token, cookie, user.username)
    res.status(200).json(await getItsmSharedCredentialsMeta())
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo guardar el token ITSM'
    res.status(400).json({ error: message })
  }
}

export async function handleVercelItsmSearch(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!(await requireUser(req, res))) return
  if (!(await guardItsmCredentials(res))) return

  try {
    const upstream = await itsmFetch(buildItsmSearchUrl(), {
      method: 'POST',
      body: JSON.stringify(req.body ?? {}),
    })
    await finishItsmTextProxy(res, upstream)
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

export async function handleVercelItsmAdditionalFields(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!(await requireUser(req, res))) return
  if (!(await guardItsmCredentials(res))) return

  try {
    const upstream = await itsmFetch(buildAdditionalFieldsUrl(), {
      method: 'POST',
      body: JSON.stringify(req.body ?? {}),
    })
    await finishItsmTextProxy(res, upstream)
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

export async function handleVercelItsmItem(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!(await requireUser(req, res))) return
  if (!(await guardItsmCredentials(res))) return

  const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined
  if (!itemId) {
    res.status(400).json({ error: 'itemId es obligatorio' })
    return
  }

  try {
    const item = await fetchItsmItem(itemId)
    res.status(200).json({
      description: pickString(item.description),
      descriptionNoHtml: pickString(item.descriptionNoHtml),
    })
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

export async function handleVercelItsmItemFiles(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!(await requireUser(req, res))) return
  if (!(await guardItsmCredentials(res))) return

  const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined
  const itemType =
    typeof req.query.itemType === 'string' ? req.query.itemType : '1'

  if (!itemId) {
    res.status(400).json({ error: 'itemId es obligatorio' })
    return
  }

  try {
    const upstream = await itsmFetch(buildItemFilesUrl(itemId, itemType), {
      method: 'GET',
    })
    await finishItsmTextProxy(res, upstream)
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

export async function handleVercelItsmItemHistory(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!(await requireUser(req, res))) return
  if (!(await guardItsmCredentials(res))) return

  const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined
  const isClosed = req.query.isClosed === 'true'
  const modelId =
    typeof req.query.modelId === 'string' ? Number(req.query.modelId) : NaN
  const statusId =
    typeof req.query.statusId === 'string' ? Number(req.query.statusId) : NaN
  const pageIndex =
    typeof req.query.pageIndex === 'string'
      ? Number(req.query.pageIndex)
      : undefined
  const pageSize =
    typeof req.query.pageSize === 'string'
      ? Number(req.query.pageSize)
      : undefined

  if (!itemId || Number.isNaN(modelId) || Number.isNaN(statusId)) {
    res.status(400).json({
      error: 'itemId, modelId y statusId son obligatorios',
    })
    return
  }

  try {
    const upstream = await itsmFetch(
      buildItemHistoryUrl(itemId, {
        isClosed,
        modelId,
        statusId,
        pageIndex:
          pageIndex !== undefined && !Number.isNaN(pageIndex)
            ? pageIndex
            : undefined,
        pageSize:
          pageSize !== undefined && !Number.isNaN(pageSize)
            ? pageSize
            : undefined,
      }),
      { method: 'GET' },
    )
    await finishItsmTextProxy(res, upstream)
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

export async function handleVercelItsmFile(
  req: VercelRequest,
  res: VercelResponse,
  fileId: string,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!(await requireUser(req, res))) return
  if (!(await guardItsmCredentials(res))) return

  const resolvedFileId = fileId.trim()
  const fileName =
    typeof req.query.fileName === 'string' ? req.query.fileName : undefined

  if (!resolvedFileId) {
    res.status(400).json({ error: 'fileId es obligatorio' })
    return
  }

  try {
    const upstream = await itsmFetch(buildFileUrl(resolvedFileId), {
      method: 'GET',
    })

    if (upstream.status === 401) {
      const body = await upstream.text()
      await clearItsmSharedCredentials()
      res.status(401).json(itsmTokenRequiredPayload(body))
      return
    }

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
    handleItsmProxyError(res, error)
  }
}

export async function handleVercelItsmGroups(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const session = await requireAdminSessionFromAuthHeader(
    req.headers.authorization,
  )
  if (!session) {
    res.status(403).json({
      error:
        'Se requiere acceso administrador para consultar grupos de asignación',
    })
    return
  }

  if (!(await guardItsmCredentials(res))) return

  const serviceId =
    typeof req.query.serviceId === 'string'
      ? Number(req.query.serviceId)
      : NaN
  const stateId =
    typeof req.query.stateId === 'string' ? Number(req.query.stateId) : NaN

  if (Number.isNaN(serviceId) || Number.isNaN(stateId)) {
    res.status(400).json({ error: 'serviceId y stateId son obligatorios' })
    return
  }

  try {
    const upstream = await fetchItsmGroups(serviceId, stateId)
    await finishItsmTextProxy(res, upstream)
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

export async function handleVercelItsmGroupSpecialists(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const session = await requireAdminSessionFromAuthHeader(
    req.headers.authorization,
  )
  if (!session) {
    res.status(403).json({
      error: 'Se requiere acceso administrador para consultar responsables',
    })
    return
  }

  if (!(await guardItsmCredentials(res))) return

  const groupId =
    typeof req.query.groupId === 'string' ? Number(req.query.groupId) : NaN
  const projectId =
    typeof req.query.projectId === 'string'
      ? Number(req.query.projectId)
      : NaN

  if (Number.isNaN(groupId) || Number.isNaN(projectId)) {
    res.status(400).json({ error: 'groupId y projectId son obligatorios' })
    return
  }

  try {
    const upstream = await fetchItsmGroupSpecialists(groupId, projectId)
    await finishItsmTextProxy(res, upstream)
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

export async function handleVercelItsmAssignResponsible(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const session = await requireAdminSessionFromAuthHeader(
    req.headers.authorization,
  )
  if (!session) {
    res.status(403).json({
      error: 'Se requiere acceso administrador para cambiar el responsable',
    })
    return
  }

  const { itemId, groupId, responsibleId, itemContext } = req.body ?? {}

  if (typeof itemId !== 'number' && typeof itemId !== 'string') {
    res.status(400).json({ error: 'itemId es obligatorio' })
    return
  }

  if (typeof groupId !== 'number' || typeof responsibleId !== 'number') {
    res.status(400).json({ error: 'groupId y responsibleId son obligatorios' })
    return
  }

  if (!isValidContext(itemContext)) {
    res.status(400).json({ error: 'itemContext es obligatorio' })
    return
  }

  if (!(await guardItsmCredentials(res))) return

  try {
    await assignItemResponsible(
      String(itemId),
      groupId,
      responsibleId,
      itemContext,
    )
    res.status(200).json({ ok: true })
  } catch (error) {
    handleItsmProxyError(res, error)
  }
}

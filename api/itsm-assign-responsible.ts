import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  assignItemResponsible,
  type ItemAssignContext,
} from '../lib/assignResponsible.js'
import { requireAdminSessionFromAuthHeader } from '../lib/itsmApi.js'
import { guardItsmCredentials, handleItsmProxyError } from '../lib/itsmVercelProxy.js'

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const session = await requireAdminSessionFromAuthHeader(req.headers.authorization)
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

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  handleVercelAdoBranchSearch,
  handleVercelAdoItemSearch,
} from './vercelAdoHandlers.js'
import {
  handleVercelAuthLogin,
  handleVercelAuthVerify,
} from './vercelAuthHandlers.js'
import {
  handleVercelItsmAdditionalFields,
  handleVercelItsmAssignResponsible,
  handleVercelItsmCredentials,
  handleVercelItsmFile,
  handleVercelItsmGroupSpecialists,
  handleVercelItsmGroups,
  handleVercelItsmItem,
  handleVercelItsmItemFiles,
  handleVercelItsmItemHistory,
  handleVercelItsmSearch,
} from './vercelItsmHandlers.js'
import { handleVercelUrgentCases } from './vercelUrgentHandlers.js'

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.filter(Boolean).join('/')
  return typeof value === 'string' ? value : ''
}

function getPathname(req: VercelRequest): string {
  try {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
      .replace(/\/+$/, '')
    if (pathname.startsWith('/api/') && pathname !== '/api/index') {
      return pathname
    }
  } catch {
    // Ignore malformed URLs and fall through.
  }

  const routed = firstQueryValue(req.query.route)
  if (routed) {
    return `/api/${routed.replace(/^\/+|\/+$/g, '')}`
  }

  return '/api'
}

export async function routeVercelApi(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const pathname = getPathname(req)

  if (pathname === '/api/auth/login') {
    await handleVercelAuthLogin(req, res)
    return
  }

  if (pathname === '/api/auth/verify') {
    await handleVercelAuthVerify(req, res)
    return
  }

  if (pathname === '/api/itsm-credentials') {
    await handleVercelItsmCredentials(req, res)
    return
  }

  if (pathname === '/api/itsm-search') {
    await handleVercelItsmSearch(req, res)
    return
  }

  if (pathname === '/api/itsm-additionalfields') {
    await handleVercelItsmAdditionalFields(req, res)
    return
  }

  if (pathname === '/api/itsm-item') {
    await handleVercelItsmItem(req, res)
    return
  }

  if (pathname === '/api/itsm-item-files') {
    await handleVercelItsmItemFiles(req, res)
    return
  }

  if (pathname === '/api/itsm-item-history') {
    await handleVercelItsmItemHistory(req, res)
    return
  }

  if (pathname.startsWith('/api/itsm-file/')) {
    const fileId = decodeURIComponent(pathname.slice('/api/itsm-file/'.length))
    await handleVercelItsmFile(req, res, fileId)
    return
  }

  if (pathname === '/api/itsm-groups') {
    await handleVercelItsmGroups(req, res)
    return
  }

  if (pathname === '/api/itsm-group-specialists') {
    await handleVercelItsmGroupSpecialists(req, res)
    return
  }

  if (pathname === '/api/itsm-assign-responsible') {
    await handleVercelItsmAssignResponsible(req, res)
    return
  }

  if (pathname === '/api/urgent-cases') {
    await handleVercelUrgentCases(req, res)
    return
  }

  if (pathname === '/api/ado-branch-search') {
    await handleVercelAdoBranchSearch(req, res)
    return
  }

  if (pathname === '/api/ado-item-search') {
    await handleVercelAdoItemSearch(req, res)
    return
  }

  res.status(404).json({ error: 'Not found' })
}

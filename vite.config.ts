import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import { handleAuthLogin, handleAuthVerify, handleItsmAuthGuard } from './lib/authDevServer.js'
import {
  handleItsmAdditionalFields,
  handleItsmAssignResponsible,
  handleItsmFile,
  handleItsmGroupSpecialists,
  handleItsmGroups,
  handleItsmItemFiles,
  handleItsmItemHistory,
  handleItsmSearch,
  isProtectedItsmApi,
} from './lib/itsmDevHandlers.js'
import {
  configureItsmRuntimeEnv,
  warmItsmSessionToken,
} from './lib/itsmUpstream.js'
import {
  resolveItsmIntegrationTokenFromEnv,
} from './lib/env.js'

function createAuthMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost')
    const pathname = requestUrl.pathname

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      void handleAuthLogin(req, res)
      return
    }

    if (pathname === '/api/auth/verify' && req.method === 'GET') {
      void handleAuthVerify(req, res)
      return
    }

    if (pathname === '/api/itsm-search' && req.method === 'POST') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmSearch(req, res)
      })
      return
    }

    if (pathname === '/api/itsm-additionalfields' && req.method === 'POST') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmAdditionalFields(req, res)
      })
      return
    }

    if (pathname === '/api/itsm-item-files' && req.method === 'GET') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmItemFiles(req, res, requestUrl)
      })
      return
    }

    if (pathname === '/api/itsm-item-history' && req.method === 'GET') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmItemHistory(req, res, requestUrl)
      })
      return
    }

    if (pathname.startsWith('/api/itsm-file/') && req.method === 'GET') {
      const fileId = pathname.replace('/api/itsm-file/', '')
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmFile(req, res, fileId, requestUrl)
      })
      return
    }

    if (pathname === '/api/itsm-groups' && req.method === 'GET') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmGroups(req, res, requestUrl)
      })
      return
    }

    if (pathname === '/api/itsm-group-specialists' && req.method === 'GET') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmGroupSpecialists(req, res, requestUrl)
      })
      return
    }

    if (pathname === '/api/itsm-assign-responsible' && req.method === 'POST') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmAssignResponsible(req, res)
      })
      return
    }

    if (isProtectedItsmApi(pathname, req.method)) {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) next()
      })
      return
    }

    next()
  }
}

function authApiDevPlugin(env: Record<string, string>): Plugin {
  configureItsmRuntimeEnv({
    integrationToken: resolveItsmIntegrationTokenFromEnv(env),
  })

  const middleware = createAuthMiddleware()

  return {
    name: 'auth-api-dev',
    configureServer(server) {
      server.middlewares.use(middleware)
      void warmItsmSessionToken().catch((error) => {
        console.warn(
          '[itsm] No se pudo precargar token de sesión:',
          error instanceof Error ? error.message : error,
        )
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), authApiDevPlugin(env)],
    server: {
      port: 5173,
    },
    preview: {
      port: 4173,
    },
  }
})

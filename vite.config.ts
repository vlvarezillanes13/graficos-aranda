import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import { handleAuthLogin, handleAuthVerify, handleItsmAuthGuard } from './lib/authDevServer.js'

const rootDir = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(
  readFileSync(join(rootDir, 'package.json'), 'utf-8'),
) as { version: string }
import {
  handleItsmAdditionalFields,
  handleItsmAssignResponsible,
  handleItsmCredentialsGet,
  handleItsmCredentialsPost,
  handleItsmFile,
  handleItsmGroupSpecialists,
  handleItsmGroups,
  handleItsmItemFiles,
  handleItsmItemHistory,
  handleItsmItem,
  handleItsmSearch,
  isProtectedItsmApi,
} from './lib/itsmDevHandlers.js'
import {
  handleUrgentCasesGet,
  handleUrgentCasesPost,
} from './lib/urgentCasesHandlers.js'
import {
  handleAdoBranchSearch,
  handleAdoItemSearch,
} from './lib/adoBranchSearchHandlers.js'
import { configureDevServerEnv } from './lib/itsmUpstream.js'

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

    if (pathname === '/api/itsm-credentials' && req.method === 'GET') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmCredentialsGet(req, res)
      })
      return
    }

    if (pathname === '/api/itsm-credentials' && req.method === 'POST') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmCredentialsPost(req, res)
      })
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

    if (pathname === '/api/itsm-item' && req.method === 'GET') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleItsmItem(req, res, requestUrl)
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

    if (pathname === '/api/urgent-cases' && req.method === 'GET') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleUrgentCasesGet(req, res)
      })
      return
    }

    if (pathname === '/api/urgent-cases' && req.method === 'POST') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) void handleUrgentCasesPost(req, res)
      })
      return
    }

    if (pathname === '/api/ado-branch-search' && req.method === 'GET') {
      void handleAdoBranchSearch(req, res, requestUrl)
      return
    }

    if (pathname === '/api/ado-item-search' && req.method === 'GET') {
      void handleAdoItemSearch(req, res, requestUrl)
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
  configureDevServerEnv(env)
  const middleware = createAuthMiddleware()

  return {
    name: 'auth-api-dev',
    configureServer(server) {
      server.middlewares.use(middleware)
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
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    server: {
      port: 5173,
    },
    preview: {
      port: 4173,
    },
  }
})

import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ProxyOptions } from 'vite'
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
  isProtectedItsmApi,
} from './lib/itsmDevHandlers.js'
import { configureItsmRuntimeEnv } from './lib/itsmUpstream.js'
import {
  formatItsmBearerToken,
  resolveItsmAuthCookieFromEnv,
  resolveItsmAuthTokenFromEnv,
} from './lib/env.js'

function createItsmSearchProxy(env: Record<string, string>): ProxyOptions {
  return {
    target: 'https://itsm.sonda.com',
    changeOrigin: true,
    secure: true,
    rewrite: () => '/asmsconsole/api/v9/item/search?language=0',
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq, req) => {
        proxyReq.setHeader('Accept', 'application/json, text/plain, */*')
        proxyReq.setHeader('Content-Type', 'application/json')
        proxyReq.setHeader('Origin', 'https://itsm.sonda.com')
        proxyReq.setHeader(
          'Referer',
          'https://itsm.sonda.com/asmsspecialist/index.html',
        )

        const token = resolveItsmAuthTokenFromEnv(env)
        if (token) {
          proxyReq.setHeader('x-authorization', formatItsmBearerToken(token))
        }

        const cookie = resolveItsmAuthCookieFromEnv(env)
        if (cookie) {
          proxyReq.setHeader('Cookie', cookie)
        }

        const authorization = req.headers.authorization
        if (authorization) {
          proxyReq.setHeader('Authorization', authorization)
        }
      })
    },
  }
}

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
    token: resolveItsmAuthTokenFromEnv(env),
    cookie: resolveItsmAuthCookieFromEnv(env),
  })

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
  const itsmSearchProxy = createItsmSearchProxy(env)

  return {
    plugins: [react(), authApiDevPlugin(env)],
    server: {
      port: 5173,
      proxy: {
        '/api/itsm-search': itsmSearchProxy,
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api/itsm-search': itsmSearchProxy,
      },
    },
  }
})

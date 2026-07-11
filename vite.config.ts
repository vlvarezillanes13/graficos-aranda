import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ProxyOptions } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import { handleAuthLogin, handleAuthVerify, handleItsmAuthGuard } from './lib/authDevServer'

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

        if (env.VITE_ITSM_AUTH_TOKEN) {
          const token = env.VITE_ITSM_AUTH_TOKEN.startsWith('Bearer ')
            ? env.VITE_ITSM_AUTH_TOKEN
            : `Bearer ${env.VITE_ITSM_AUTH_TOKEN}`
          proxyReq.setHeader('x-authorization', token)
        }

        if (env.VITE_ITSM_AUTH_COOKIE) {
          proxyReq.setHeader('Cookie', env.VITE_ITSM_AUTH_COOKIE)
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
    const url = req.url?.split('?')[0]

    if (url === '/api/auth/login' && req.method === 'POST') {
      void handleAuthLogin(req, res)
      return
    }

    if (url === '/api/auth/verify' && req.method === 'GET') {
      void handleAuthVerify(req, res)
      return
    }

    if (url === '/api/itsm-search' && req.method === 'POST') {
      void handleItsmAuthGuard(req, res).then((allowed) => {
        if (allowed) next()
      })
      return
    }

    next()
  }
}

function authApiDevPlugin(): Plugin {
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
    plugins: [react(), authApiDevPlugin()],
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

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api/itsm': {
          target: 'https://itsm.sonda.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/itsm/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader(
                'Accept',
                'application/json, text/plain, */*',
              )
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
            })
          },
        },
      },
    },
  }
})

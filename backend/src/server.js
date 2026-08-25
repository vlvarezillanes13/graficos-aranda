import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { Server } from 'socket.io'
import { configureUrgentCasesSocket } from './socket/urgentCasesSocket.js'

dotenv.config({ path: resolve(process.cwd(), '.env') })
dotenv.config({ path: resolve(process.cwd(), '..', '.env') })

const app = express()
const httpServer = createServer(app)

const port = Number(process.env.PORT || 3001)

const frontendPermitidos = String(
  process.env.FRONTEND_URL || 'http://localhost:5173',
)
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean)

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true)
    }

    if (frontendPermitidos.includes(origin)) {
      return callback(null, true)
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`))
  },
  methods: ['GET', 'POST'],
  credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json())

app.get('/', (_request, response) => {
  response.json({
    ok: true,
    servicio: 'Graficos realtime',
    fecha: new Date().toISOString(),
  })
})

app.get('/health', (_request, response) => {
  response.status(200).json({
    ok: true,
    uptime: process.uptime(),
  })
})

const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
})

app.use((error, _request, response, _next) => {
  console.error('[realtime]', error)
  response.status(500).json({
    ok: false,
    mensaje: error.message || 'Error interno del servidor',
  })
})

async function start() {
  await configureUrgentCasesSocket(io)

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[realtime] Backend en puerto ${port}`)
    console.log('[realtime] Frontends permitidos:', frontendPermitidos)
  })
}

void start().catch((error) => {
  console.error('[realtime] No se pudo iniciar el servidor:', error)
  process.exit(1)
})

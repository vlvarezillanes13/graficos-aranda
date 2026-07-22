import { io, type Socket } from 'socket.io-client'

export interface SharedUrgentState {
  urgentIds: string[]
  actualizadoPor: string | null
  actualizadoEn: string | null
  version: number
}

export const realtimeEnabled = Boolean(import.meta.env.VITE_REALTIME_URL)

let socketInstance: Socket | null = null

export function getRealtimeSocket(): Socket | null {
  if (!realtimeEnabled) return null

  if (!socketInstance) {
    socketInstance = io(import.meta.env.VITE_REALTIME_URL!, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })
  }

  return socketInstance
}

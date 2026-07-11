import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const

const CHECK_INTERVAL_MS = 30_000

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000

export function useIdleTimeout(
  onIdle: () => void,
  enabled: boolean,
  timeoutMs = IDLE_TIMEOUT_MS,
): void {
  const lastActivityRef = useRef(Date.now())
  const onIdleRef = useRef(onIdle)

  onIdleRef.current = onIdle

  useEffect(() => {
    if (!enabled) return

    lastActivityRef.current = Date.now()

    const markActivity = () => {
      lastActivityRef.current = Date.now()
    }

    const checkIdle = () => {
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        onIdleRef.current()
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkIdle()
      }
    }

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, markActivity, { passive: true })
    })

    document.addEventListener('visibilitychange', handleVisibility)
    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, markActivity)
      })
    }
  }, [enabled, timeoutMs])
}

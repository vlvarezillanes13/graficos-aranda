import { useEffect, useRef } from 'react'

export const BACKGROUND_REFRESH_MS = 15 * 60 * 1000

export function useBackgroundRefresh(
  callback: () => void | Promise<void>,
  enabled: boolean,
  intervalMs = BACKGROUND_REFRESH_MS,
): void {
  const callbackRef = useRef(callback)

  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      void callbackRef.current()
    }, intervalMs)

    return () => clearInterval(interval)
  }, [enabled, intervalMs])
}

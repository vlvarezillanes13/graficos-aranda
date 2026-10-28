import { useEffect, useState } from 'react'

function getMatch(query: string): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(query).matches
}

/** Se actualiza al rotar el dispositivo o redimensionar la ventana. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => getMatch(query))

  useEffect(() => {
    if (!window.matchMedia) return

    const mediaQuery = window.matchMedia(query)
    const onChange = () => setMatches(mediaQuery.matches)

    onChange()
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Móviles y tablets pequeñas (coincide con el breakpoint de responsive.css). */
export const MOBILE_QUERY = '(max-width: 768px)'

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY)
}

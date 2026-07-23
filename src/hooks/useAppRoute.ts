import { useEffect, useState } from 'react'
import {
  getAppRouteFromPath,
  navigateToRoute,
  type AppRoute,
} from '../routing/appRoute'

export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(() =>
    getAppRouteFromPath(window.location.pathname),
  )

  useEffect(() => {
    const syncRoute = () => {
      setRoute(getAppRouteFromPath(window.location.pathname))
    }

    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  return {
    route,
    navigate: navigateToRoute,
    isDashboard: route === 'dashboard',
    isReporting: route === 'reporting',
  }
}

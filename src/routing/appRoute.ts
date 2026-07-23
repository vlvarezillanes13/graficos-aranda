export type AppRoute = 'dashboard' | 'reporting'

export function getAppRouteFromPath(pathname: string): AppRoute {
  return pathname.startsWith('/reporteria') ? 'reporting' : 'dashboard'
}

export function getPathForRoute(route: AppRoute): string {
  return route === 'reporting' ? '/reporteria' : '/'
}

export function navigateToRoute(route: AppRoute): void {
  const nextPath = getPathForRoute(route)
  if (window.location.pathname === nextPath) return
  window.history.pushState(null, '', nextPath)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

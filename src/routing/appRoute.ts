export type AppRoute = 'dashboard' | 'reporting' | 'standby' | 'branch-search'

export function getAppRouteFromPath(pathname: string): AppRoute {
  if (pathname.startsWith('/reporteria')) return 'reporting'
  if (pathname.startsWith('/standby')) return 'standby'
  if (pathname.startsWith('/admin/ramas')) return 'branch-search'
  return 'dashboard'
}

export function getPathForRoute(route: AppRoute): string {
  if (route === 'reporting') return '/reporteria'
  if (route === 'standby') return '/standby'
  if (route === 'branch-search') return '/admin/ramas'
  return '/'
}

export function navigateToRoute(route: AppRoute): void {
  const nextPath = getPathForRoute(route)
  if (window.location.pathname === nextPath) return
  window.history.pushState(null, '', nextPath)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

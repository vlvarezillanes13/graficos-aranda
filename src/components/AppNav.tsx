import { useMemo } from 'react'
import type { AppRoute } from '../routing/appRoute'
import {
  formatAppBuildTooltip,
  formatAppVersionLabel,
} from '../utils/appVersion'

interface AppNavProps {
  route: AppRoute
  onNavigate: (route: AppRoute) => void
  username: string | null
  isAdmin: boolean
  loading: boolean
  urgentCount: number
  onLogout: () => void
  onRefresh: () => void
  onOpenUrgent: () => void
}

const NAV_ITEMS: Array<{
  route: AppRoute
  label: string
  hint: string
  icon: string
  modifier: 'dashboard' | 'reporting' | 'standby' | 'admin'
  adminOnly?: boolean
}> = [
  {
    route: 'dashboard',
    label: 'Panel operativo',
    hint: 'Monitoreo y tickets',
    icon: '◫',
    modifier: 'dashboard',
  },
  {
    route: 'standby',
    label: 'Standby',
    hint: 'Categoría Standby',
    icon: '⏸',
    modifier: 'standby',
  },
  {
    route: 'reporting',
    label: 'Reportería',
    hint: 'Exportaciones XLSX',
    icon: '⬇',
    modifier: 'reporting',
  },
  {
    route: 'branch-search',
    label: 'Azure DevOps',
    hint: 'Ramas y componentes',
    icon: '⎇',
    modifier: 'admin',
    adminOnly: true,
  },
]

export function AppNav({
  route,
  onNavigate,
  username,
  isAdmin,
  loading,
  urgentCount,
  onLogout,
  onRefresh,
  onOpenUrgent,
}: AppNavProps) {
  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin],
  )

  return (
    <nav className="app-nav" aria-label="Navegación principal">
      <div className="app-nav-inner">
        <div className="app-nav-brand">
          <span className="app-nav-mark" aria-hidden />
          <div className="app-nav-brand-text">
            <span className="app-nav-logo">ITSM SONDA</span>
            <span className="app-nav-tag">Consultoría AFC</span>
          </div>
          <span
            className="app-version-badge"
            title={formatAppBuildTooltip()}
            aria-label={formatAppBuildTooltip()}
          >
            {formatAppVersionLabel()}
          </span>
        </div>

        <div
          className={[
            'app-nav-tabs',
            visibleItems.length > 3 ? 'has-admin' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="tablist"
          aria-label="Secciones"
        >
          {visibleItems.map((item) => {
            const isActive = route === item.route

            return (
              <button
                key={item.route}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={[
                  'app-nav-tab',
                  `is-${item.modifier}`,
                  isActive ? 'active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onNavigate(item.route)}
              >
                <span className="app-nav-tab-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="app-nav-tab-copy">
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            )
          })}
        </div>

        <div className="app-nav-actions">
          {!loading && (
            <span className="source-badge itsm app-nav-badge">
              {username
                ? `${username}${isAdmin ? ' · Admin' : ''}`
                : 'Conectado'}
            </span>
          )}
          <button
            type="button"
            className="app-nav-action secondary"
            onClick={onOpenUrgent}
            disabled={loading}
          >
            Urgentes{urgentCount > 0 ? ` (${urgentCount})` : ''}
          </button>
          <button
            type="button"
            className="app-nav-action secondary"
            onClick={onLogout}
          >
            Salir
          </button>
          <button
            type="button"
            className="app-nav-action primary"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>
    </nav>
  )
}

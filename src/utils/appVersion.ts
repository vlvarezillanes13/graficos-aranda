export const APP_VERSION = __APP_VERSION__
export const APP_BUILD_TIME = __APP_BUILD_TIME__

export function formatAppVersionLabel(version = APP_VERSION) {
  return `v${version}`
}

export function formatAppBuildTooltip(
  version = APP_VERSION,
  buildTime = APP_BUILD_TIME,
) {
  const builtAt = new Date(buildTime)
  const formatted = Number.isNaN(builtAt.getTime())
    ? buildTime
    : new Intl.DateTimeFormat('es-CL', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(builtAt)

  return `Versión ${version} · Build ${formatted}`
}

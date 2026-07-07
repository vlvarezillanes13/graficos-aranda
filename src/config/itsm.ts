import type { ItsmSearchRequest } from '../types/itsm'

export const ITSM_SEARCH_PATH =
  '/asmsconsole/api/v9/item/search?language=0'

export const DEFAULT_SEARCH_BODY: Omit<
  ItsmSearchRequest,
  'pageIndex' | 'pageSize'
> = {
  criteria: [
    {
      fieldName: 'openedDate',
      fieldValue: 'openedDate',
      logicOperator: 1,
      operatorName: 'gte',
      operatorValue: '>=',
      type: 2,
      value: 1782129600000,
      valueName: 1782129600000,
    },
    {
      fieldName: 'serviceName',
      fieldValue: 'serviceName',
      logicOperator: null,
      operatorName: 'eq',
      operatorValue: '==',
      type: 1,
      value: 'CL-AFC-MANTENCION',
      valueName: 'CL-AFC-MANTENCION',
    },
  ],
  groups: [],
  level: 0,
  orderField: 'openedDate',
  orderType: 'desc',
  projects: [{ project: 1008 }],
  types: [
    { itemType: 3 },
    { itemType: 4 },
    { itemType: 1 },
    { itemType: 2 },
  ],
  validate: true,
  viewId: -6,
}

export const PAGE_SIZE = 50

export function getItsmApiUrl(): string {
  const base = import.meta.env.VITE_ITSM_BASE_URL?.replace(/\/$/, '')

  if (base) {
    return `${base}${ITSM_SEARCH_PATH}`
  }

  return `/api/itsm${ITSM_SEARCH_PATH}`
}

export function isItsmConfigured(): boolean {
  return (
    import.meta.env.VITE_ITSM_USE_MOCK !== 'true' &&
    Boolean(import.meta.env.VITE_ITSM_AUTH_TOKEN)
  )
}

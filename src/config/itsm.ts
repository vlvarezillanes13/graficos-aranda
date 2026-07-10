import type { ItsmSearchRequest } from '../types/itsm'

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
  repository: 1,
  types: [
    { itemType: 3 },
    { itemType: 4 },
    { itemType: 1 },
    { itemType: 2 },
  ],
  validate: true,
  viewId: -6,
}

export const CLOSED_SEARCH_BODY: Omit<
  ItsmSearchRequest,
  'pageIndex' | 'pageSize'
> = {
  ...DEFAULT_SEARCH_BODY,
  repository: 2,
}

export const PAGE_SIZE = 50

export const ITSM_API_PATH = '/api/itsm-search'

export function getItsmApiUrl(): string {
  return ITSM_API_PATH
}

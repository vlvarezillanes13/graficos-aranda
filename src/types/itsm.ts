import type { IncidentItem } from './incident'

export interface ItsmSearchCriterion {
  fieldName: string
  fieldValue: string
  logicOperator: number | null
  operatorName: string
  operatorValue: string
  type: number
  value: string | number
  valueName: string | number
}

export interface ItsmSearchRequest {
  criteria: ItsmSearchCriterion[]
  groups: unknown[]
  level: number
  orderField: string
  orderType: 'asc' | 'desc'
  pageIndex: number
  pageSize: number
  projects: { project: number }[]
  repository?: number
  types: { itemType: number }[]
  validate: boolean
  viewId: number
}

export interface ItsmSearchResponse {
  content: IncidentItem[]
  totalItems: number
  totalPage: number
  additionalData: unknown
}

export interface FetchResult {
  items: IncidentItem[]
  totalItems: number
  fetchedAt: Date
}

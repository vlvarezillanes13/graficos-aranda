export type TaggedCaseKind = 'urgent' | 'stabilization'

export interface TaggedCaseListConfig {
  storageKey: string
  unlockKeyName: string
  grantsKey: string
  idsField: 'urgentIds' | 'stabilizationIds'
  label: string
  labelSingular: string
  /** Si es true, cada ticket puede tener un frente asociado (campo `frentes`). */
  supportsFrentes: boolean
}

export const TAGGED_CASE_LISTS: Record<TaggedCaseKind, TaggedCaseListConfig> = {
  urgent: {
    storageKey: 'graficos:urgent-cases',
    unlockKeyName: 'graficos:urgent-unlock-key',
    grantsKey: 'graficos:urgent-edit-grants',
    idsField: 'urgentIds',
    label: 'urgentes',
    labelSingular: 'urgente',
    supportsFrentes: false,
  },
  stabilization: {
    storageKey: 'graficos:stabilization-cases',
    unlockKeyName: 'graficos:stabilization-unlock-key',
    grantsKey: 'graficos:stabilization-edit-grants',
    idsField: 'stabilizationIds',
    label: 'estabilización',
    labelSingular: 'estabilización',
    supportsFrentes: true,
  },
}

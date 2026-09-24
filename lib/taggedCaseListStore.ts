import { readStorageJson, writeStorageJson } from './serverStorage.js'
import {
  hasTaggedCasesSessionGrant,
  revokeAllTaggedCasesGrants,
  TaggedCasesSessionLockedError,
} from './taggedCaseListGrants.js'
import {
  TAGGED_CASE_LISTS,
  type TaggedCaseKind,
} from './taggedCaseListConfig.js'

export interface TaggedCasesState {
  caseIds: string[]
  actualizadoPor: string | null
  actualizadoEn: string | null
  version: number
  edicionBloqueada: boolean
}

const EMPTY_STATE: TaggedCasesState = {
  caseIds: [],
  actualizadoPor: null,
  actualizadoEn: null,
  version: 0,
  edicionBloqueada: true,
}

export class TaggedCasesEditLockedError extends Error {
  constructor(label: string) {
    super(
      `La actualización de casos de ${label} está bloqueada por un administrador`,
    )
    this.name = 'TaggedCasesEditLockedError'
  }
}

export { TaggedCasesSessionLockedError } from './taggedCaseListGrants.js'

function isEditLocked(value: unknown): boolean {
  return value !== false
}

function normalizeCaseIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const value of raw) {
    const id = String(value ?? '')
      .trim()
      .toUpperCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }

  return normalized
}

function readStoredIds(
  stored: Record<string, unknown> | null,
  idsField: string,
): unknown {
  if (!stored) return []
  if (Array.isArray(stored[idsField])) return stored[idsField]
  if (Array.isArray(stored.caseIds)) return stored.caseIds
  return []
}

export function toPublicTaggedCasesState(
  kind: TaggedCaseKind,
  state: TaggedCasesState,
): Record<string, unknown> {
  const { idsField } = TAGGED_CASE_LISTS[kind]
  return {
    [idsField]: state.caseIds,
    actualizadoPor: state.actualizadoPor,
    actualizadoEn: state.actualizadoEn,
    version: state.version,
    edicionBloqueada: state.edicionBloqueada,
  }
}

export async function getTaggedCasesState(
  kind: TaggedCaseKind,
): Promise<TaggedCasesState> {
  const config = TAGGED_CASE_LISTS[kind]
  const stored = await readStorageJson<Record<string, unknown>>(config.storageKey)
  if (!stored) return { ...EMPTY_STATE }

  return {
    caseIds: normalizeCaseIds(readStoredIds(stored, config.idsField)),
    actualizadoPor:
      typeof stored.actualizadoPor === 'string' ? stored.actualizadoPor : null,
    actualizadoEn:
      typeof stored.actualizadoEn === 'string' ? stored.actualizadoEn : null,
    version: typeof stored.version === 'number' ? stored.version : 0,
    edicionBloqueada: isEditLocked(stored.edicionBloqueada),
  }
}

export async function updateTaggedCasesState(
  kind: TaggedCaseKind,
  caseIds: unknown,
  usuario: string,
  sessionToken?: string | null,
): Promise<TaggedCasesState> {
  const current = await getTaggedCasesState(kind)
  const config = TAGGED_CASE_LISTS[kind]
  if (current.edicionBloqueada) {
    throw new TaggedCasesEditLockedError(config.label)
  }

  if (!(await hasTaggedCasesSessionGrant(kind, sessionToken))) {
    throw new TaggedCasesSessionLockedError(config.label)
  }

  const next: TaggedCasesState = {
    caseIds: normalizeCaseIds(caseIds),
    actualizadoPor: usuario.trim() || 'Usuario',
    actualizadoEn: new Date().toISOString(),
    version: current.version + 1,
    edicionBloqueada: current.edicionBloqueada,
  }

  await writeStorageJson(config.storageKey, toPublicTaggedCasesState(kind, next))
  return next
}

export async function setTaggedCasesEditLock(
  kind: TaggedCaseKind,
  edicionBloqueada: boolean,
  usuario: string,
): Promise<TaggedCasesState> {
  const current = await getTaggedCasesState(kind)
  const locked = edicionBloqueada === true
  const next: TaggedCasesState = {
    ...current,
    edicionBloqueada: locked,
    actualizadoPor: usuario.trim() || 'Usuario',
    actualizadoEn: new Date().toISOString(),
    version: current.version + 1,
  }

  await writeStorageJson(
    TAGGED_CASE_LISTS[kind].storageKey,
    toPublicTaggedCasesState(kind, next),
  )
  if (locked) {
    await revokeAllTaggedCasesGrants(kind)
  }
  return next
}

import type { IncidentItem } from '../types/incident'
import type {
  AssignmentGroup,
  AssignmentSpecialist,
  ItemAssignContext,
  PaginatedContent,
} from '../types/assignment'
import { getAuthHeaders } from './authService'

function parsePaginatedContent<T>(payload: unknown): T[] {
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as PaginatedContent<T>).content)
  ) {
    return (payload as PaginatedContent<T>).content
  }

  return []
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({}))
  if (data && typeof data === 'object' && typeof data.error === 'string') {
    return data.error
  }

  return fallback
}

export function buildItemAssignContext(item: IncidentItem): ItemAssignContext {
  return {
    id: item.id,
    itemType: item.itemType,
    modelId: item.modelId,
    stateId: item.stateId,
    categoryId: item.categoryId,
    serviceId: item.serviceId,
    projectId: item.projectId,
    applicantId: item.applicantId,
    companyId: item.companyId,
    customerId: item.customerId,
    locationId: item.LocationId,
    reasonId: item.reasonId,
    registryTypeId: item.registryTypeId,
  }
}

export async function fetchAssignmentGroups(
  serviceId: number,
  stateId: number,
): Promise<AssignmentGroup[]> {
  const params = new URLSearchParams({
    serviceId: String(serviceId),
    stateId: String(stateId),
  })

  const response = await fetch(`/api/itsm-groups?${params}`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'No se pudieron cargar los grupos'),
    )
  }

  const payload = await response.json()
  return parsePaginatedContent<AssignmentGroup>(payload).filter(
    (group) => group.active === 1,
  )
}

export async function fetchGroupSpecialists(
  groupId: number,
  projectId: number,
): Promise<AssignmentSpecialist[]> {
  const params = new URLSearchParams({
    groupId: String(groupId),
    projectId: String(projectId),
  })

  const response = await fetch(`/api/itsm-group-specialists?${params}`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'No se pudieron cargar los responsables'),
    )
  }

  const payload = await response.json()
  return parsePaginatedContent<AssignmentSpecialist>(payload)
}

export async function assignTicketResponsible(
  item: IncidentItem,
  groupId: number,
  responsibleId: number,
): Promise<void> {
  const response = await fetch('/api/itsm-assign-responsible', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemId: item.id,
      groupId,
      responsibleId,
      itemContext: buildItemAssignContext(item),
    }),
  })

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'No se pudo actualizar el responsable'),
    )
  }
}

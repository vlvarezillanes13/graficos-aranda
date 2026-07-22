import type { IncidentItem } from '../types/incident'
import type {
  AssignmentGroup,
  AssignmentSpecialist,
  ItemAssignContext,
  PaginatedContent,
} from '../types/assignment'
import { ensureItsmApiOk, fetchItsmApi } from './itsmApiClient'

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

  const response = await ensureItsmApiOk(
    await fetchItsmApi(`/api/itsm-groups?${params}`),
  )

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

  const response = await ensureItsmApiOk(
    await fetchItsmApi(`/api/itsm-group-specialists?${params}`),
  )

  const payload = await response.json()
  return parsePaginatedContent<AssignmentSpecialist>(payload)
}

export async function assignTicketResponsible(
  item: IncidentItem,
  groupId: number,
  responsibleId: number,
): Promise<void> {
  const response = await ensureItsmApiOk(
    await fetchItsmApi('/api/itsm-assign-responsible', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId: item.id,
        groupId,
        responsibleId,
        itemContext: buildItemAssignContext(item),
      }),
    }),
  )

  void response
}

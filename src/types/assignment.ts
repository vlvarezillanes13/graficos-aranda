export interface AssignmentGroup {
  id: number
  name: string
  active: number
}

export interface AssignmentSpecialist {
  id: number
  name: string
}

export interface ItemAssignContext {
  id: number
  itemType: number
  modelId: number
  stateId: number
  categoryId: number
  serviceId: number
  projectId: number
  applicantId: number
  companyId: number
  customerId: number
  locationId: number
  reasonId: number
  registryTypeId: number
}

export interface PaginatedContent<T> {
  content: T[]
  totalItems: number
}

export interface IncidentItem {
  LocationId: number
  LocationName: string
  additionals: unknown[]
  applicantId: number
  applicantName: string
  approvalType: number
  authorId: number
  authorName: string
  backgroundColorRgb: string
  buildingId: number | null
  buildingName: string | null
  categoryHierarchy: string
  categoryId: number
  categoryName: string
  ciAssetTag: string | null
  ciId: number | null
  ciName: string | null
  ciSerial: string | null
  cityId: number | null
  cityName: string | null
  closedDate: number | null
  closenessToExpiration: number
  companyId: number
  companyName: string
  cost: number
  countryId: number | null
  countryName: string | null
  currentProgress: number
  currentTime: number
  customerGroupsSpecial: unknown[]
  customerId: number
  customerName: string
  departmentCode: string | null
  departmentCodeName: string | null
  descriptionNoHtml: string
  duration: number | null
  effort: number
  estimatedTime: number
  expectedDate: number
  finalDate: number | null
  finalStateId: number
  floorId: number | null
  floorName: string | null
  foregroundColorRgb: string
  groupId: number
  groupName: string
  id: number
  idByProject: string
  impactId: number
  impactName: string
  initialDate: number | null
  initialStatus: boolean
  isClosed: boolean
  isFieldTask: boolean | null
  isVotingProcess: boolean
  isfollowed: boolean | null
  isimported: boolean
  itemType: number
  itemTypeName: string
  itemVersion: number
  knownError: boolean | null
  majorProblem: boolean | null
  modelId: number
  modelName: string
  modifiedDate: number
  olaId: number | null
  olaName: string | null
  openedDate: number
  parentId: number | null
  parentIdByProject: string | null
  parentItemType: string | null
  parentItemTypeId: number | null
  price: number
  priorityId: number
  priorityName: string
  progress: number
  projectId: number
  projectName: string
  providerId: number | null
  providerName: string | null
  realDate: number | null
  reasonId: number
  reasonName: string
  receptorId: number
  receptorName: string
  registryTypeId: number
  registryTypeName: string
  responsibleId: number
  responsibleName: string
  riskName: string | null
  serviceId: number
  serviceName: string
  slaId: number
  slaName: string
  stateId: number
  stateName: string
  subject: string
  templateId: number | null
  time: number
  ucId: number | null
  ucName: string | null
  unitId: number | null
  unitName: string | null
  urgencyId: number
  urgencyName: string
}

export interface CountItem {
  name: string
  count: number
}

export type GroupField =
  | 'groupName'
  | 'itemTypeName'
  | 'responsibleName'
  | 'stateName'
  | 'priorityName'
  | 'categoryName'

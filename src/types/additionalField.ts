export interface AdditionalField {
  name: string
  identifier: string
  fieldId: number
  dateValue: number | null
  fieldTypeName: string
}

export interface AdditionalFieldsRequest {
  asdkWeb: boolean
  categoryId: number
  consoleType: 'specialist'
  id: number
  itemType: number
  modelId: number
  serviceId: number
  stateId: number
}

export interface ItemDeliveryDates {
  deliveryDate: number | null
  deliveryTestDate: number | null
  pendingAfpDate: number | null
}

export interface HistoryDetail {
  dataType: number | null
  fieldName: string
  newValue: string | null
  oldValue: string | null
  relatedItemId: number | null
  type: number | null
}

export interface HistoryEntry {
  actionId: number
  actionName: string
  authorId: number
  authorName: string
  created: number
  description: string
  descriptionNoHtml: string | null
  detail: HistoryDetail[]
  id: number
  itemId: number
  itemType: number | null
  reviewCode: number | null
  visible: boolean
}

export interface ItemHistoryResponse {
  content: HistoryEntry[]
  totalItems: number
}

export interface ItemAttachment {
  date: number
  description: string
  id: number
  isPublic: boolean
  name: string
  size: number
  url: string | null
  userId: number
  userName: string
}

export interface ItemFilesResponse {
  content: ItemAttachment[]
  totalItems: number
}

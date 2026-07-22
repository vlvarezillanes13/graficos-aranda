import type { ItemAttachment, ItemFilesResponse } from '../types/attachment'
import { ensureItsmApiOk, fetchItsmApi } from './itsmApiClient'

export type PreviewKind = 'image' | 'pdf' | 'other'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getPreviewKind(fileName: string, contentType: string): PreviewKind {
  const normalizedType = contentType.toLowerCase()
  if (normalizedType.startsWith('image/')) return 'image'
  if (normalizedType === 'application/pdf') return 'pdf'

  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return 'image'
  }
  if (extension === 'pdf') return 'pdf'
  return 'other'
}

export async function fetchItemFiles(
  itemId: number,
  itemType: number,
): Promise<ItemAttachment[]> {
  const params = new URLSearchParams({
    itemId: String(itemId),
    itemType: String(itemType),
  })

  const response = await ensureItsmApiOk(
    await fetchItsmApi(`/api/itsm-item-files?${params}`),
  )

  const data = (await response.json()) as ItemFilesResponse
  return data.content ?? []
}

export async function fetchFileBlob(
  fileId: number,
  fileName: string,
): Promise<{ blob: Blob; contentType: string }> {
  const params = new URLSearchParams({ fileName })
  const response = await ensureItsmApiOk(
    await fetchItsmApi(`/api/itsm-file/${fileId}?${params}`),
  )

  const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream'
  const blob = await response.blob()
  return { blob, contentType }
}

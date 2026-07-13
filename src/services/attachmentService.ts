import type { ItemAttachment, ItemFilesResponse } from '../types/attachment'
import { getAuthHeaders } from './authService'

export async function fetchItemFiles(
  itemId: number,
  itemType: number,
): Promise<ItemAttachment[]> {
  const params = new URLSearchParams({
    itemId: String(itemId),
    itemType: String(itemType),
  })

  const response = await fetch(`/api/itsm-item-files?${params}`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(
      typeof detail.error === 'string'
        ? detail.error
        : `Error al cargar adjuntos (${response.status})`,
    )
  }

  const data = (await response.json()) as ItemFilesResponse
  return data.content ?? []
}

export async function fetchFileBlob(
  fileId: number,
  fileName: string,
): Promise<{ blob: Blob; contentType: string }> {
  const response = await fetch(`/api/itsm-file/${fileId}`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(`No se pudo abrir ${fileName}`)
  }

  const contentType =
    response.headers.get('content-type') ?? guessContentType(fileName)

  return {
    blob: await response.blob(),
    contentType,
  }
}

function guessContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'pdf':
      return 'application/pdf'
    case 'txt':
      return 'text/plain'
    default:
      return 'application/octet-stream'
  }
}

export type PreviewKind = 'image' | 'pdf' | 'text' | 'unsupported'

export function getPreviewKind(
  fileName: string,
  contentType: string,
): PreviewKind {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType === 'application/pdf') return 'pdf'
  if (contentType.startsWith('text/')) return 'text'

  const extension = fileName.split('.').pop()?.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension ?? '')) {
    return 'image'
  }
  if (extension === 'pdf') return 'pdf'
  if (extension === 'txt') return 'text'

  return 'unsupported'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

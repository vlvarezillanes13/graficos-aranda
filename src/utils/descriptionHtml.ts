import { fetchFileBlob } from '../services/attachmentService'

const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'CENTER',
  'CODE',
  'DIV',
  'EM',
  'FONT',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'I',
  'IMG',
  'LI',
  'OL',
  'P',
  'PRE',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'U',
  'UL',
])

const GLOBAL_ATTRS = new Set(['class', 'style', 'title'])

const TAG_ATTRS: Record<string, Set<string>> = {
  A: new Set(['href', 'target', 'rel']),
  FONT: new Set(['color', 'face', 'size']),
  IMG: new Set(['src', 'alt', 'width', 'height']),
  TD: new Set(['colspan', 'rowspan', 'align', 'valign']),
  TH: new Set(['colspan', 'rowspan', 'align', 'valign']),
  TABLE: new Set(['border', 'cellpadding', 'cellspacing', 'width']),
}

const FILE_ID_PATTERNS = [
  /\/api\/v\d+\/file\/(\d+)/i,
  /[?&](?:fileId|id)=(\d+)/i,
]

export interface PreparedDescriptionHtml {
  html: string
  revoke: () => void
}

function isSafeUrl(value: string, allowDataImage = false): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  if (allowDataImage && /^data:image\//i.test(trimmed)) return true
  if (trimmed.startsWith('blob:')) return true
  if (/^https?:\/\//i.test(trimmed)) return true
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true
  }

  return false
}

function extractFileId(src: string): string | null {
  for (const pattern of FILE_ID_PATTERNS) {
    const match = src.match(pattern)
    if (match?.[1]) return match[1]
  }

  if (/^\d+$/.test(src.trim())) return src.trim()
  return null
}

function sanitizeNode(node: Node): void {
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node)
    return
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return

  const element = node as HTMLElement
  const tag = element.tagName

  if (!ALLOWED_TAGS.has(tag)) {
    const parent = element.parentNode
    if (!parent) return
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element)
    }
    parent.removeChild(element)
    return
  }

  for (const attr of [...element.attributes]) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on') || name === 'srcdoc') {
      element.removeAttribute(attr.name)
      continue
    }

    const allowedForTag = TAG_ATTRS[tag]
    const allowed = GLOBAL_ATTRS.has(name) || allowedForTag?.has(name)
    if (!allowed) {
      element.removeAttribute(attr.name)
      continue
    }

    if (name === 'href') {
      const href = attr.value.trim()
      if (/^javascript:/i.test(href) || !isSafeUrl(href)) {
        element.removeAttribute(attr.name)
      } else if (element.getAttribute('target') === '_blank') {
        element.setAttribute('rel', 'noopener noreferrer')
      }
    }

    if (name === 'src' && tag === 'IMG') {
      if (!isSafeUrl(attr.value, true)) {
        element.removeAttribute(attr.name)
      }
    }

    if (name === 'style' && /expression|url\s*\(\s*['"]?\s*javascript:/i.test(attr.value)) {
      element.removeAttribute(attr.name)
    }
  }

  for (const child of [...element.childNodes]) {
    sanitizeNode(child)
  }
}

export function sanitizeDescriptionHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const child of [...doc.body.childNodes]) {
    sanitizeNode(child)
  }
  return doc.body.innerHTML
}

async function resolveImageSrc(
  src: string,
  objectUrls: string[],
): Promise<string | null> {
  const trimmed = src.trim()
  if (!trimmed) return null
  if (/^data:image\//i.test(trimmed) || trimmed.startsWith('blob:')) {
    return trimmed
  }

  const fileId = extractFileId(trimmed)
  if (!fileId) return null

  try {
    const { blob } = await fetchFileBlob(Number(fileId), `image-${fileId}`)
    const objectUrl = URL.createObjectURL(blob)
    objectUrls.push(objectUrl)
    return objectUrl
  } catch {
    return null
  }
}

export async function prepareDescriptionHtml(
  html: string,
): Promise<PreparedDescriptionHtml> {
  const objectUrls: string[] = []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const images = [...doc.body.querySelectorAll('img')]

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src') ?? ''
      const resolved = await resolveImageSrc(src, objectUrls)
      if (resolved) {
        img.setAttribute('src', resolved)
        img.removeAttribute('srcset')
      } else {
        img.remove()
      }
    }),
  )

  for (const child of [...doc.body.childNodes]) {
    sanitizeNode(child)
  }

  return {
    html: doc.body.innerHTML,
    revoke: () => {
      for (const url of objectUrls) {
        URL.revokeObjectURL(url)
      }
      objectUrls.length = 0
    },
  }
}

export function descriptionHasVisualContent(html: string): boolean {
  const trimmed = html.trim()
  if (!trimmed) return false
  if (/<img\b/i.test(trimmed)) return true
  const text = trimmed.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
  return text.length > 0
}

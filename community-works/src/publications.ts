export type WorkKind = 'novel' | 'book-analysis'

export interface PublicWorkCard {
  slug: string
  kind: WorkKind
  title: string
  description: string
  authorName: string
  updatedAt: string
  language: string
}

export interface PublicDimension {
  index: number
  key: string
  label: string
  selected: boolean
  entryCount: number
}

export interface PublicWorkDetail extends PublicWorkCard {
  chapterCount: number
  chapters: Array<{ index: number; title: string }>
  dimensions: PublicDimension[]
  hasAuthorCommentary: boolean
}

export const apiRoot = '/api/community/v1/publications'
const workKinds = new Set<WorkKind>(['novel', 'book-analysis'])

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length <= limit
}

export function parseCard(value: unknown): PublicWorkCard | null {
  const item = record(value)
  if (!item || !text(item.slug, 100) || !/^[a-z0-9-]{1,100}$/.test(item.slug) ||
      !workKinds.has(item.kind as WorkKind) || !text(item.title, 300) ||
      !text(item.description, 4000) || !text(item.authorName, 120) ||
      !text(item.updatedAt, 50) || !text(item.language, 30)) return null
  return {
    slug: item.slug,
    kind: item.kind as WorkKind,
    title: item.title,
    description: item.description,
    authorName: item.authorName,
    updatedAt: item.updatedAt,
    language: item.language,
  }
}

export function parseListPage(value: unknown, offset: number): { items: PublicWorkCard[]; nextOffset: number | null } {
  const data = record(value)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000000 || !data ||
      !Array.isArray(data.items) || data.items.length > 50 ||
      (data.nextOffset !== null && (data.items.length !== 50 || data.nextOffset !== offset + 50))) {
    throw new Error('作品集返回了无效列表')
  }
  const cards = data.items.map(parseCard)
  if (cards.some(card => !card)) throw new Error('作品集返回了无效作品')
  return { items: cards as PublicWorkCard[], nextOffset: data.nextOffset as number | null }
}

export function parseDetail(value: unknown): PublicWorkDetail | null {
  const card = parseCard(value)
  const data = record(value)
  const toc = data && record(data.toc)
  if (!card || !toc || toc.kind !== card.kind || !Number.isSafeInteger(toc.total) ||
      (toc.total as number) < 1 || !Array.isArray(toc.items) || toc.items.length > 100 ||
      toc.items.length !== Math.min(toc.total as number, 100)) return null
  if (card.kind === 'novel') {
    const chapters = parseChapterPage(toc, 0)
    return chapters ? { ...card, chapterCount: toc.total as number, chapters, dimensions: [], hasAuthorCommentary: false } : null
  }
  if (toc.total !== 13) return null
  const dimensions: PublicDimension[] = []
  for (const [index, raw] of toc.items.entries()) {
    const item = record(raw)
    if (!item || item.index !== index || !text(item.key, 100) || !text(item.label, 300) ||
        typeof item.selected !== 'boolean' || !Number.isSafeInteger(item.entryCount) ||
        (item.entryCount as number) < 0 || (!item.selected && item.entryCount !== 0)) return null
    dimensions.push({ index, key: item.key, label: item.label, selected: item.selected, entryCount: item.entryCount as number })
  }
  if (typeof toc.hasAuthorCommentary !== 'boolean') return null
  return { ...card, chapterCount: 0, chapters: [], dimensions, hasAuthorCommentary: toc.hasAuthorCommentary }
}

export function parseChapterPage(value: unknown, offset: number): Array<{ index: number; title: string }> | null {
  const page = record(value)
  if (!page || page.kind !== 'novel' || !Number.isSafeInteger(page.total) ||
      !Array.isArray(page.items) || page.items.length > 100 ||
      page.items.length !== Math.min(Math.max((page.total as number) - offset, 0), 100)) return null
  const chapters: Array<{ index: number; title: string }> = []
  for (const [position, raw] of page.items.entries()) {
    const item = record(raw)
    if (!item || item.index !== offset + position || !text(item.title, 300)) return null
    chapters.push({ index: item.index as number, title: item.title })
  }
  return chapters
}

export function parseEntryPage(value: unknown, offset: number, expectedTotal: number): Array<{ index: number; label: string }> | null {
  const page = record(value)
  if (!page || page.kind !== 'book-analysis' || page.total !== expectedTotal ||
      !Array.isArray(page.items) || page.items.length > 100 ||
      page.items.length !== Math.min(Math.max(expectedTotal - offset, 0), 100)) return null
  const entries: Array<{ index: number; label: string }> = []
  for (const [position, raw] of page.items.entries()) {
    const item = record(raw)
    if (!item || item.index !== offset + position || !text(item.label, 300)) return null
    entries.push({ index: item.index as number, label: item.label })
  }
  return entries
}

export async function loadTextParts(slug: string, section: number, entry: number, signal: AbortSignal): Promise<string> {
  const parts: string[] = []
  let totalLength = 0
  for (let part = 0; part <= 1000; part++) {
    const value = record(await loadJson(`${apiRoot}/${slug}/part?section=${section}&entry=${entry}&part=${part}`, signal))
    if (!value || !text(value.text, 1_000_000) || typeof value.hasMore !== 'boolean') throw new Error('作品内容无效')
    totalLength += value.text.length
    if (totalLength > 32 * 1024 * 1024) throw new Error('作品内容超出预算')
    parts.push(value.text)
    if (!value.hasMore) return parts.join('')
    if (!value.text) throw new Error('作品内容不完整')
  }
  throw new Error('作品内容分段过多')
}

export async function loadJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`作品集服务暂时不可用（${response.status}）`)
  return response.json() as Promise<unknown>
}

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
  key: string
  label: string
  selected: boolean
  entries: Array<{ label: string; text: string }>
}

export interface PublicWorkDetail extends PublicWorkCard {
  chapters: Array<{ title: string; content: string }>
  dimensions: PublicDimension[]
  authorCommentary: string
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

export function parseList(value: unknown): PublicWorkCard[] {
  const data = record(value)
  if (!data || !Array.isArray(data.items) || data.items.length > 100) throw new Error('作品集返回了无效列表')
  const cards = data.items.map(parseCard)
  if (cards.some(card => !card)) throw new Error('作品集返回了无效作品')
  return cards as PublicWorkCard[]
}

function parseEntries(value: unknown): Array<{ label: string; text: string }> | null {
  if (!Array.isArray(value) || value.length > 10000) return null
  const entries: Array<{ label: string; text: string }> = []
  for (const raw of value) {
    const entry = record(raw)
    if (!entry || !text(entry.label, 300) || !text(entry.text, 2_000_000)) return null
    entries.push({ label: entry.label, text: entry.text })
  }
  return entries
}

export function parseDetail(value: unknown): PublicWorkDetail | null {
  const card = parseCard(value)
  const data = record(value)
  if (!card || !data || !Array.isArray(data.chapters) || !Array.isArray(data.dimensions) ||
      data.chapters.length > 10000 || data.dimensions.length > 13 ||
      !text(data.authorCommentary, 100_000)) return null
  const chapters: PublicWorkDetail['chapters'] = []
  for (const raw of data.chapters) {
    const chapter = record(raw)
    if (!chapter || !text(chapter.title, 300) || !text(chapter.content, 2_000_000)) return null
    chapters.push({ title: chapter.title, content: chapter.content })
  }
  const dimensions: PublicDimension[] = []
  for (const raw of data.dimensions) {
    const dimension = record(raw)
    if (!dimension || !text(dimension.key, 100) || !text(dimension.label, 300) ||
        typeof dimension.selected !== 'boolean') return null
    const entries = parseEntries(dimension.entries)
    if (!entries || (!dimension.selected && entries.length > 0)) return null
    dimensions.push({ key: dimension.key, label: dimension.label, selected: dimension.selected, entries })
  }
  if (card.kind === 'novel' && (!chapters.length || dimensions.length)) return null
  if (card.kind === 'book-analysis' && (chapters.length || dimensions.length !== 13)) return null
  return { ...card, chapters, dimensions, authorCommentary: data.authorCommentary }
}

export async function loadJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`作品集服务暂时不可用（${response.status}）`)
  return response.json() as Promise<unknown>
}

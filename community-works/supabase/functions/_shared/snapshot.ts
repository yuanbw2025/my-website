const dimensions = [
  'narrativeStyle', 'openingTechnique', 'plotStructure', 'pacingControl',
  'climaxDesign', 'conflictEscalation', 'characterCraft', 'dialogueTechnique',
  'proseStyle', 'emotionalBeats', 'foreshadowing', 'worldBuilding',
  'otherTechniques',
] as const

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key))
}

function boundedText(value: unknown, maximum: number, required = false): value is string {
  return typeof value === 'string' && value.length <= maximum && (!required || value.trim().length > 0)
}

/** Reject unknown keys so a forged client cannot attach local IDs, prompts, source text or credentials. */
export function validPublicSnapshotV1(value: unknown): boolean {
  const data = object(value)
  if (!data || data.schemaVersion !== 1) return false
  if (data.kind === 'novel') {
    if (!keys(data, ['schemaVersion', 'kind', 'title', 'description', 'genres', 'chapters']) ||
        !boundedText(data.title, 300, true) || !boundedText(data.description, 4000) ||
        !Array.isArray(data.genres) || !data.genres.every(genre => boundedText(genre, 100, true)) ||
        !Array.isArray(data.chapters) || data.chapters.length === 0) return false
    return data.chapters.every(raw => {
      const chapter = object(raw)
      return chapter && keys(chapter, ['title', 'content']) &&
        boundedText(chapter.title, 300, true) && boundedText(chapter.content, 33554432, true)
    })
  }
  if (data.kind === 'book-analysis') {
    if (!keys(data, ['schemaVersion', 'kind', 'book', 'analysis', 'dimensions', 'authorCommentary']) ||
        !boundedText(data.authorCommentary, 100000)) return false
    const book = object(data.book)
    const analysis = object(data.analysis)
    if (!book || !keys(book, ['title', 'author', 'genre']) ||
        !boundedText(book.title, 300, true) || !boundedText(book.author, 300) ||
        !boundedText(book.genre, 100) || !analysis || !keys(analysis, ['version', 'depth']) ||
        typeof analysis.version !== 'number' || !Number.isSafeInteger(analysis.version) || analysis.version < 1 ||
        !['quick', 'deep'].includes(analysis.depth as string) ||
        !Array.isArray(data.dimensions) || data.dimensions.length !== dimensions.length) return false
    let hasContent = false
    for (let index = 0; index < dimensions.length; index++) {
      const dimension = object(data.dimensions[index])
      if (!dimension || !keys(dimension, ['key', 'selected', 'entries']) ||
          dimension.key !== dimensions[index] || typeof dimension.selected !== 'boolean' ||
          !Array.isArray(dimension.entries) || (!dimension.selected && dimension.entries.length > 0)) return false
      for (const raw of dimension.entries) {
        const entry = object(raw)
        if (!entry || !keys(entry, ['label', 'text']) || !boundedText(entry.label, 300, true) ||
            !boundedText(entry.text, 33554432, true)) return false
        hasContent = true
      }
    }
    return hasContent
  }
  return false
}

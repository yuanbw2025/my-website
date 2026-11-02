import { validPublicSnapshotV1 } from './snapshot.ts'
const maxSnapshotBytes = 32 * 1024 * 1024
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const hash = /^[0-9a-f]{64}$/
export async function readBounded(response: Response, maximum: number): Promise<Uint8Array> {
  if (!response.body) throw new Error('empty_body')
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maximum) throw new Error('body_too_large')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > maximum) throw new Error('body_too_large')
      chunks.push(next.value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}

export async function readVerifiedSnapshot(base: URL, secret: string, row: Record<string, unknown>, fetcher: typeof fetch = fetch) {
  const path = String(row.object_path ?? '')
  const owner = String(row.owner_uid ?? '')
  const expectedLength = Number(row.byte_length)
  if (!uuid.test(owner) || !path.startsWith(`${owner}/`) || !hash.test(String(row.sha256 ?? '')) ||
      !Number.isSafeInteger(expectedLength) || expectedLength < 1 || expectedLength > maxSnapshotBytes) {
    throw new Error('invalid_submission_record')
  }
  const storage = await fetcher(new URL(`/storage/v1/object/authenticated/community-intake/${path}`, base), {
    headers: { apikey: secret }, signal: AbortSignal.timeout(45000),
  })
  if (!storage.ok) throw new Error('snapshot_unavailable')
  const bytes = await readBounded(storage, maxSnapshotBytes)
  if (bytes.byteLength !== expectedLength) throw new Error('snapshot_length_mismatch')
  const actualHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    byte => byte.toString(16).padStart(2, '0')).join('')
  if (actualHash !== row.sha256) throw new Error('snapshot_hash_mismatch')
  const snapshot: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (!validPublicSnapshotV1(snapshot) || (snapshot as { kind: string }).kind !== row.kind) {
    throw new Error('invalid_public_snapshot')
  }
  return snapshot as Record<string, unknown>
}

const labels: Record<string, string> = {
  narrativeStyle: '叙事风格', openingTechnique: '开篇技法', plotStructure: '情节结构',
  pacingControl: '节奏控制', climaxDesign: '高潮设计', conflictEscalation: '冲突升级',
  characterCraft: '人物塑造', dialogueTechnique: '对话技法', proseStyle: '语言风格',
  emotionalBeats: '情绪节拍', foreshadowing: '伏笔设计', worldBuilding: '世界构建',
  otherTechniques: '其他技法',
}

/** Build a public projection from verified bytes; client-supplied publication fields are ignored. */
export function publication(snapshot: Record<string, unknown>, objectPath: string) {
  if (snapshot.kind === 'novel') {
    const chapters = snapshot.chapters as Array<{ title: string; content: string }>
    return {
      kind: 'novel', title: snapshot.title, description: snapshot.description,
      language: 'zh-CN', objectPath,
      toc: { chapters: chapters.map(chapter => ({ title: chapter.title })) },
    }
  }
  const book = snapshot.book as Record<string, unknown>
  const dimensions = (snapshot.dimensions as Array<Record<string, unknown>>).map(item => ({
    key: item.key, label: labels[String(item.key)], selected: item.selected, entries: item.entries,
  }))
  return {
    kind: 'book-analysis', title: `${String(book.title)} · 拆书分析`,
    description: `作者分享的《${String(book.title)}》拆书分析`, language: 'zh-CN',
    objectPath,
    toc: { dimensions: dimensions.map(item => ({
      key: item.key, label: item.label, selected: item.selected,
      entries: (item.entries as Array<{ label: string }>).map(entry => ({ label: entry.label })),
    })), hasAuthorCommentary: Boolean(snapshot.authorCommentary) },
  }
}


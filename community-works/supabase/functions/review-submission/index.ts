import { validPublicSnapshotV1 } from '../_shared/snapshot.ts'
import { secondFactorVerified } from '../_shared/reviewer-session.ts'

const maxSnapshotBytes = 32 * 1024 * 1024
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const hash = /^[0-9a-f]{64}$/
const decisions = new Set(['begin_review', 'approve', 'needs_changes', 'reject', 'publish', 'take_down'])
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }

function answer(status: number, value: Record<string, unknown>): Response {
  return new Response(JSON.stringify(value), { status, headers })
}

function settings() {
  const url = Deno.env.get('SUPABASE_URL')
  const publishable = Deno.env.get('COMMUNITY_PUBLISHABLE_KEY')
  const secret = Deno.env.get('COMMUNITY_SECRET_KEY')
  if (!url || !publishable || !secret) return null
  try {
    const base = new URL(url)
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) return null
    return { base, publishable, secret }
  } catch { return null }
}

async function json(base: URL, secret: string, path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(new URL(path, base), {
    ...options,
    headers: { apikey: secret, Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`upstream_${response.status}`)
  return response.json()
}

async function activeReviewerUid(base: URL, publishable: string, secret: string, authorization: string): Promise<string | null> {
  if (!/^Bearer [A-Za-z0-9._-]{40,}$/.test(authorization)) return null
  const response = await fetch(new URL('/auth/v1/user', base), {
    headers: { apikey: publishable, Authorization: authorization }, signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  const user = await response.json()
  if (typeof user?.id !== 'string' || !uuid.test(user.id)) return null
  const membership = await json(base, secret,
    `/rest/v1/community_reviewers?select=uid,role&uid=eq.${user.id}&active=eq.true&limit=1`) as unknown[]
  return Array.isArray(membership) && membership.length === 1 ? user.id : null
}

async function readBounded(response: Response, maximum: number): Promise<Uint8Array> {
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

async function readVerifiedSnapshot(base: URL, secret: string, row: Record<string, unknown>) {
  const path = String(row.object_path ?? '')
  const owner = String(row.owner_uid ?? '')
  const expectedLength = Number(row.byte_length)
  if (!uuid.test(owner) || !path.startsWith(`${owner}/`) || !hash.test(String(row.sha256 ?? '')) ||
      !Number.isSafeInteger(expectedLength) || expectedLength < 1 || expectedLength > maxSnapshotBytes) {
    throw new Error('invalid_submission_record')
  }
  const storage = await fetch(new URL(`/storage/v1/object/authenticated/community-intake/${path}`, base), {
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
function publication(snapshot: Record<string, unknown>, objectPath: string) {
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

Deno.serve(async request => {
  if (!['GET', 'POST'].includes(request.method)) return answer(405, { error: 'method_not_allowed' })
  const config = settings()
  if (!config) return answer(503, { error: 'moderation_unavailable' })
  let actor: string | null
  try {
    actor = await activeReviewerUid(config.base, config.publishable, config.secret,
      request.headers.get('authorization') ?? '')
  } catch { return answer(503, { error: 'reviewer_auth_unavailable' }) }
  if (!actor) return answer(403, { error: 'reviewer_required' })
  if (request.method === 'GET' && new URL(request.url).searchParams.get('scope') === 'eligibility') {
    return answer(200, { reviewer: true })
  }
  if (!secondFactorVerified(request.headers.get('authorization') ?? '', actor)) {
    return answer(403, { error: 'second_factor_required' })
  }

  try {
    const submissionId = new URL(request.url).searchParams.get('submissionId')
    if (request.method === 'GET' && !submissionId) {
      const rows = await json(config.base, config.secret,
        '/rest/v1/community_submissions?select=id,kind,status,sha256,created_at,public_pen_name&status=in.(submitted,human_review,approved)&order=created_at.asc&limit=50')
      return answer(200, { items: rows })
    }
    if (!submissionId || !uuid.test(submissionId)) return answer(400, { error: 'invalid_submission_id' })
    const rows = await json(config.base, config.secret,
      `/rest/v1/community_submissions?select=id,owner_uid,kind,status,sha256,byte_length,object_path,created_at,public_pen_name&id=eq.${submissionId}&limit=1`) as Record<string, unknown>[]
    const row = Array.isArray(rows) ? rows[0] : null
    if (!row) return answer(404, { error: 'submission_not_found' })
    if (request.method === 'GET') {
      await readVerifiedSnapshot(config.base, config.secret, row)
      const signed = await json(config.base, config.secret,
        `/storage/v1/object/sign/community-intake/${String(row.object_path)}`, {
          method: 'POST', body: JSON.stringify({ expiresIn: 60 }),
        }) as Record<string, unknown>
      if (typeof signed.signedURL !== 'string' || !signed.signedURL.startsWith('/object/sign/community-intake/')) {
        throw new Error('signed_review_url_unavailable')
      }
      const snapshotUrl = new URL(`/storage/v1${signed.signedURL}`, config.base)
      return answer(200, { submission: {
        id: row.id, kind: row.kind, status: row.status, sha256: row.sha256,
        createdAt: row.created_at, publicPenName: row.public_pen_name,
      }, snapshotUrl: snapshotUrl.toString(), expiresIn: 60 })
    }
    if (Number(request.headers.get('content-length') ?? 0) > 8192) return answer(413, { error: 'request_too_large' })
    const raw = await readBounded(new Response(request.body), 8192)
    let input: Record<string, unknown>
    try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) }
    catch { return answer(400, { error: 'invalid_request' }) }
    if (!input || !decisions.has(String(input.decision)) ||
        !hash.test(String(input.revisionSha256 ?? '')) ||
        !/^[a-z][a-z0-9_]{1,39}$/.test(String(input.reasonCode ?? '')) ||
        typeof input.privateNote !== 'string' || input.privateNote.length > 4000 ||
        Object.keys(input).some(key => !['decision', 'revisionSha256', 'reasonCode', 'privateNote'].includes(key))) {
      return answer(400, { error: 'invalid_decision' })
    }
    if (input.revisionSha256 !== row.sha256) return answer(409, { error: 'revision_mismatch' })
    if (input.decision === 'publish' && Deno.env.get('COMMUNITY_PUBLISH_ENABLED') !== '1') {
      return answer(503, { error: 'publishing_paused' })
    }
    let publicProjection = null
    if (input.decision === 'publish') {
      const snapshot = await readVerifiedSnapshot(config.base, config.secret, row)
      publicProjection = publication(snapshot, String(row.object_path))
    }
    const next = await json(config.base, config.secret, '/rest/v1/rpc/community_review_transition', {
      method: 'POST',
      body: JSON.stringify({
        p_actor_uid: actor, p_submission_id: submissionId,
        p_revision_sha256: row.sha256, p_decision: input.decision,
        p_reason_code: input.reasonCode, p_private_note: input.privateNote,
        p_publication: publicProjection,
      }),
    })
    return answer(200, { submissionId, status: next })
  } catch {
    // Failed reads, hash checks, and DB transactions never change visibility here.
    return answer(503, { error: 'moderation_unavailable' })
  }
})

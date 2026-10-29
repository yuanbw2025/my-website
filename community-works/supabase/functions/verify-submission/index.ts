import { validPublicSnapshotV1 } from '../_shared/snapshot.ts'

const maxBytes = 32 * 1024 * 1024
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function answer(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders })
}

function credentials() {
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

async function adminJson(base: URL, secret: string, path: string, options: RequestInit = {}): Promise<unknown> {
  const result = await fetch(new URL(path, base), {
    ...options,
    headers: { apikey: secret, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(10000),
  })
  if (!result.ok) throw new Error(`upstream_${result.status}`)
  return result.json()
}

async function ownerFromToken(base: URL, publishable: string, authorization: string): Promise<string | null> {
  if (!/^Bearer [A-Za-z0-9._-]{40,}$/.test(authorization)) return null
  const result = await fetch(new URL('/auth/v1/user', base), {
    headers: { apikey: publishable, Authorization: authorization }, signal: AbortSignal.timeout(8000),
  })
  if (!result.ok) return null
  const user = await result.json()
  return typeof user?.id === 'string' && uuid.test(user.id) ? user.id : null
}

Deno.serve(async request => {
  if (request.method !== 'POST') return answer(405, { error: 'method_not_allowed' })
  const config = credentials()
  if (!config) return answer(503, { error: 'submission_unavailable' })
  let ownerUid: string | null
  try { ownerUid = await ownerFromToken(config.base, config.publishable, request.headers.get('authorization') ?? '') }
  catch { return answer(503, { error: 'auth_unavailable' }) }
  if (!ownerUid) return answer(401, { error: 'authentication_required' })
  if (Number(request.headers.get('content-length') ?? 0) > 4096) return answer(413, { error: 'request_too_large' })
  let input: Record<string, unknown>
  try { input = await request.json() } catch { return answer(400, { error: 'invalid_request' }) }
  if (!input || !uuid.test(String(input.sessionId ?? '')) || input.rightsConfirmed !== true ||
      !['all-rights-reserved', 'cc-by-4.0'].includes(String(input.license ?? '')) ||
      typeof input.publicPenName !== 'string' || !input.publicPenName.trim() || input.publicPenName.length > 120) {
    return answer(400, { error: 'rights_confirmation_required' })
  }

  try {
    const sessionId = String(input.sessionId)
    const rows = await adminJson(config.base, config.secret,
      `/rest/v1/community_upload_sessions?select=id,owner_uid,kind,object_path,sha256,byte_length,status,expires_at&id=eq.${sessionId}&owner_uid=eq.${ownerUid}&limit=1`) as Record<string, unknown>[]
    const session = Array.isArray(rows) ? rows[0] : null
    if (!session) return answer(404, { error: 'session_not_found' })
    const existing = await adminJson(config.base, config.secret,
      `/rest/v1/community_submissions?select=id,status,sha256&upload_session_id=eq.${sessionId}&owner_uid=eq.${ownerUid}&limit=1`) as Record<string, unknown>[]
    if (Array.isArray(existing) && existing.length) {
      return answer(200, { submissionId: existing[0].id, status: existing[0].status })
    }
    if (session.status !== 'created' || typeof session.byte_length !== 'number' ||
        session.byte_length < 1 || session.byte_length > maxBytes ||
        Date.parse(String(session.expires_at)) + 86400000 < Date.now()) {
      return answer(409, { error: 'session_not_usable' })
    }
    const objectPath = String(session.object_path)
    if (!objectPath.startsWith(`${ownerUid}/`) || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/snapshot\.json$/.test(objectPath)) {
      return answer(409, { error: 'session_not_usable' })
    }
    const storage = await fetch(new URL(`/storage/v1/object/authenticated/community-intake/${objectPath}`, config.base), {
      headers: { apikey: config.secret }, signal: AbortSignal.timeout(30000),
    })
    if (storage.status === 404) return answer(409, { error: 'upload_not_complete' })
    if (!storage.ok) throw new Error('storage_unavailable')
    const bytes = new Uint8Array(await storage.arrayBuffer())
    if (bytes.byteLength !== session.byte_length || bytes.byteLength > maxBytes) {
      return answer(422, { error: 'snapshot_length_mismatch' })
    }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      part => part.toString(16).padStart(2, '0')).join('')
    if (digest !== session.sha256) return answer(422, { error: 'snapshot_hash_mismatch' })
    let snapshot: unknown
    try { snapshot = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
    catch { return answer(422, { error: 'invalid_snapshot_json' }) }
    if (!validPublicSnapshotV1(snapshot) || (snapshot as { kind: string }).kind !== session.kind) {
      return answer(422, { error: 'invalid_public_snapshot' })
    }
    const inserted = await adminJson(config.base, config.secret, '/rest/v1/community_submissions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        owner_uid: ownerUid, upload_session_id: sessionId, kind: session.kind,
        object_path: objectPath, sha256: session.sha256, byte_length: session.byte_length,
        public_pen_name: input.publicPenName.trim(), license: input.license,
        rights_statement_version: 1, status: 'submitted',
      }),
    }) as Record<string, unknown>[]
    if (!Array.isArray(inserted) || inserted.length !== 1) throw new Error('submission_insert_failed')
    await adminJson(config.base, config.secret,
      `/rest/v1/community_upload_sessions?id=eq.${sessionId}&owner_uid=eq.${ownerUid}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'verified' }),
      })
    return answer(201, { submissionId: inserted[0].id, status: 'submitted' })
  } catch {
    return answer(503, { error: 'submission_unavailable' })
  }
})

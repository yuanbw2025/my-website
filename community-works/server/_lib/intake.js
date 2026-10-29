import { response } from './catalog.js'

const MAX_BYTES = 32 * 1024 * 1024
const BUCKET = 'community-intake'

function settings() {
  const url = process.env.COMMUNITY_SUPABASE_URL
  const publishable = process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY
  const secret = process.env.COMMUNITY_SUPABASE_SECRET_KEY
  if (!url || !publishable || !secret) return null
  try {
    const base = new URL(url)
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) return null
    return { base, publishable, secret }
  } catch { return null }
}

async function userFromRequest(request, config, fetcher) {
  const authorization = request.headers.get('authorization')
  if (!authorization || !/^Bearer [A-Za-z0-9._-]{40,}$/.test(authorization)) return null
  const url = new URL('/auth/v1/user', config.base)
  const result = await fetcher(url, { headers: { apikey: config.publishable, Authorization: authorization }, signal: AbortSignal.timeout(8000) })
  if (!result.ok) return null
  const user = await result.json()
  return typeof user?.id === 'string' && /^[0-9a-f-]{36}$/.test(user.id) ? user.id : null
}

async function allocate(config, ownerUid, input, fetcher) {
  const url = new URL('/rest/v1/rpc/community_allocate_upload_session', config.base)
  const result = await fetcher(url, {
    method: 'POST',
    headers: { apikey: config.secret, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_owner_uid: ownerUid, p_idempotency_key: input.idempotencyKey,
      p_kind: input.kind, p_sha256: input.sha256, p_byte_length: input.byteLength }),
    signal: AbortSignal.timeout(8000),
  })
  if (!result.ok) throw new Error('private_database_unavailable')
  return result.json()
}

async function signTarget(config, path, fetcher) {
  const url = new URL(`/storage/v1/object/upload/sign/${BUCKET}/${path}`, config.base)
  const result = await fetcher(url, {
    method: 'POST',
    headers: { apikey: config.secret, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(8000),
  })
  if (!result.ok) throw new Error('storage_unavailable')
  const body = await result.json()
  // Storage returns a path relative to its /storage/v1 base, as in storage-js.
  // Reconstruct from the exact allocated object path, never from an upstream URL.
  if (typeof body?.url !== 'string') throw new Error('storage_unavailable')
  const returned = new URL(body.url, 'https://storage.invalid')
  const expectedPath = `/object/upload/sign/${BUCKET}/${path}`
  const tokens = returned.searchParams.getAll('token')
  if (returned.origin !== 'https://storage.invalid' || returned.pathname !== expectedPath ||
      returned.hash || [...returned.searchParams.keys()].some(key => key !== 'token') ||
      tokens.length !== 1 || !tokens[0] || tokens[0].length > 4096) {
    throw new Error('storage_unavailable')
  }
  const token = tokens[0]
  const signedUrl = new URL(`/storage/v1${expectedPath}`, config.base)
  signedUrl.searchParams.set('token', token)
  return { signedUrl: signedUrl.toString(), token }
}

async function smallJsonBody(request) {
  if (!request.body) return { error: 'invalid_request' }
  const reader = request.body.getReader()
  const chunks = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > 4096) {
      await reader.cancel()
      return { error: 'request_too_large' }
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } }
  catch { return { error: 'invalid_request' } }
}

/** No manuscript bytes pass through this function. It only allocates one private signed target. */
export async function createUploadSession(request, fetcher = fetch) {
  if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' })
  if (process.env.COMMUNITY_ACCEPTING_SUBMISSIONS !== '1') return response(503, { error: 'intake_paused' })
  const config = settings()
  if (!config) return response(503, { error: 'intake_unavailable' })
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return response(415, { error: 'json_required' })
  }
  if (Number(request.headers.get('content-length') ?? 0) > 4096) return response(413, { error: 'request_too_large' })
  let userId
  try { userId = await userFromRequest(request, config, fetcher) } catch { return response(503, { error: 'auth_unavailable' }) }
  if (!userId) return response(401, { error: 'authentication_required' })
  let parsed
  try { parsed = await smallJsonBody(request) } catch { return response(400, { error: 'invalid_request' }) }
  if (parsed.error) return response(parsed.error === 'request_too_large' ? 413 : 400, { error: parsed.error })
  const input = parsed.value
  if (!input || typeof input !== 'object' || !['novel', 'book-analysis'].includes(input.kind) ||
      !/^[0-9a-f]{64}$/.test(input.sha256 ?? '') || !Number.isSafeInteger(input.byteLength) ||
      input.byteLength < 1 || input.byteLength > MAX_BYTES ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.idempotencyKey ?? '')) {
    return response(400, { error: 'invalid_manifest' })
  }

  try {
    const row = await allocate(config, userId, input, fetcher)
    if (row?.error === 'daily_upload_limit') return response(429, { error: row.error })
    if (['idempotency_conflict', 'upload_session_expired_or_used'].includes(row?.error)) {
      return response(409, { error: row.error })
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row?.id ?? '') ||
        row.owner_uid !== userId || row.kind !== input.kind || row.sha256 !== input.sha256 ||
        row.byte_length !== input.byteLength || row.object_path !== `${userId}/${row.id}/snapshot.json` ||
        row.status !== 'created' || Date.parse(row.expires_at) <= Date.now()) {
      throw new Error('private_database_unavailable')
    }
    const target = await signTarget(config, row.object_path, fetcher)
    return response(201, {
      sessionId: row.id, signedUrl: target.signedUrl, token: target.token,
      tusEndpoint: new URL('/storage/v1/upload/resumable', config.base).toString(),
      objectPath: row.object_path, expiresAt: row.expires_at,
      byteLength: row.byte_length, sha256: row.sha256,
    })
  } catch {
    return response(503, { error: 'intake_unavailable' })
  }
}

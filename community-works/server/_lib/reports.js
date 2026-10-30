import { response } from './catalog.js'
import { privateCors } from './cors.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const slug = /^[a-z0-9-]{1,100}$/
const reasons = new Set(['child_safety', 'sexual_violence', 'violence_threat', 'hate', 'privacy', 'copyright', 'illegal_trade', 'other'])

export function settings() {
  const raw = process.env.COMMUNITY_SUPABASE_URL
  const publishable = process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY
  const secret = process.env.COMMUNITY_SUPABASE_SECRET_KEY
  if (!raw || !publishable || !secret) return null
  try {
    const base = new URL(raw)
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) return null
    return { base, publishable, secret }
  } catch { return null }
}

export async function uidFromToken(config, authorization, fetcher) {
  if (!/^Bearer [A-Za-z0-9._-]{40,}$/.test(authorization ?? '')) return null
  const user = await fetcher(new URL('/auth/v1/user', config.base), {
    headers: { apikey: config.publishable, Authorization: authorization },
    signal: AbortSignal.timeout(8000),
  })
  if (!user.ok) return null
  const body = await user.json()
  return typeof body?.id === 'string' && uuid.test(body.id) ? body.id : null
}

export async function adminJson(config, path, options, fetcher) {
  const upstream = await fetcher(new URL(path, config.base), {
    ...options,
    headers: { apikey: config.secret, Accept: 'application/json', 'Content-Type': 'application/json',
      ...(options?.headers ?? {}) },
    signal: AbortSignal.timeout(10000),
  })
  if (!upstream.ok) throw new Error('upstream_unavailable')
  return upstream.json()
}

/** Called only after Auth has validated this exact bearer token via /auth/v1/user. */
export function reviewerSessionAal2(authorization, uid) {
  const match = /^Bearer [A-Za-z0-9_-]{1,8192}\.([A-Za-z0-9_-]{1,8192})\.[A-Za-z0-9_-]{1,8192}$/.exec(authorization ?? '')
  if (!match) return false
  try {
    const payload = JSON.parse(atob(match[1].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - match[1].length % 4) % 4)))
    return payload?.sub === uid && payload?.aal === 'aal2' && payload?.role === 'authenticated' &&
      Number.isSafeInteger(payload?.exp) && payload.exp > Date.now() / 1000
  } catch { return false }
}

export async function reviewer(config, uid, authorization, fetcher) {
  if (!reviewerSessionAal2(authorization, uid)) return false
  const members = await adminJson(config,
    `/rest/v1/community_reviewers?select=uid&uid=eq.${uid}&active=eq.true&limit=1`, {}, fetcher)
  return Array.isArray(members) && members.length === 1
}

export async function smallJson(request, maxBytes) {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return null
  if (!request.body) return null
  const reader = request.body.getReader()
  const chunks = []
  let length = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > maxBytes) return null
      chunks.push(next.value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { return null }
}

export async function handleReports(request, fetcher = fetch) {
  const cors = privateCors(request, 'GET, POST')
  if (cors.early) return cors.early
  const reply = (status, value) => cors.apply(response(status, value))
  if (!['GET', 'POST'].includes(request.method)) return reply(405, { error: 'method_not_allowed' })
  const config = settings()
  if (!config) return reply(503, { error: 'reports_unavailable' })
  let uid
  try { uid = await uidFromToken(config, request.headers.get('authorization'), fetcher) }
  catch { return reply(503, { error: 'auth_unavailable' }) }
  if (!uid) return reply(401, { error: 'authentication_required' })

  try {
    if (request.method === 'GET') {
      const scope = new URL(request.url).searchParams.get('scope')
      if (scope === 'mine') {
        const upstream = await fetcher(new URL(
          '/rest/v1/community_reports?select=id,reason_code,status,created_at,publication_id&order=created_at.desc&limit=50',
          config.base), {
          headers: { apikey: config.publishable, Authorization: request.headers.get('authorization') },
          signal: AbortSignal.timeout(8000),
        })
        if (!upstream.ok) throw new Error('reports_unavailable')
        const items = await upstream.json()
        if (!Array.isArray(items) || items.length > 50) throw new Error('invalid_reports')
        return reply(200, { items })
      }
      if (scope !== 'queue') return reply(400, { error: 'invalid_scope' })
      if (!await reviewer(config, uid, request.headers.get('authorization'), fetcher)) return reply(403, { error: 'reviewer_required' })
      const items = await adminJson(config,
        '/rest/v1/community_reports?select=id,publication_id,reason_code,details,status,created_at&status=in.(open,escalated)&order=created_at.asc&limit=50', {}, fetcher)
      return reply(200, { items })
    }
    const body = await smallJson(request, 4096)
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !slug.test(body.slug ?? '') || !reasons.has(body.reasonCode) ||
        typeof body.details !== 'string' || body.details.length > 2000 ||
        Object.keys(body).some(key => !['slug', 'reasonCode', 'details'].includes(key))) {
      return reply(400, { error: 'invalid_report' })
    }
    const id = await adminJson(config, '/rest/v1/rpc/community_file_report', {
      method: 'POST', body: JSON.stringify({ p_reporter_uid: uid, p_slug: body.slug,
        p_reason_code: body.reasonCode, p_details: body.details }),
    }, fetcher)
    if (typeof id !== 'string' || !uuid.test(id)) throw new Error('invalid_report_id')
    return reply(201, { reportId: id, status: 'open' })
  } catch { return reply(503, { error: 'reports_unavailable' }) }
}

export async function handleReportDecision(request, fetcher = fetch) {
  const cors = privateCors(request, 'POST')
  if (cors.early) return cors.early
  const reply = (status, value) => cors.apply(response(status, value))
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
  const config = settings()
  if (!config) return reply(503, { error: 'moderation_unavailable' })
  let uid
  try { uid = await uidFromToken(config, request.headers.get('authorization'), fetcher) }
  catch { return reply(503, { error: 'auth_unavailable' }) }
  if (!uid) return reply(401, { error: 'authentication_required' })
  const body = await smallJson(request, 4096)
  if (!body || typeof body !== 'object' || Array.isArray(body) || !uuid.test(body.reportId ?? '') ||
      !['escalate', 'dismiss', 'take_down'].includes(body.decision) ||
      typeof body.reasonCode !== 'string' || !/^[a-z][a-z0-9_]{1,39}$/.test(body.reasonCode) ||
      typeof body.privateNote !== 'string' || body.privateNote.length > 4000 ||
      Object.keys(body).some(key => !['reportId', 'decision', 'reasonCode', 'privateNote'].includes(key))) {
    return reply(400, { error: 'invalid_decision' })
  }
  try {
    if (!await reviewer(config, uid, request.headers.get('authorization'), fetcher)) return reply(403, { error: 'reviewer_required' })
    const status = await adminJson(config, '/rest/v1/rpc/community_review_report', {
      method: 'POST', body: JSON.stringify({ p_actor_uid: uid, p_report_id: body.reportId,
        p_decision: body.decision, p_reason_code: body.reasonCode,
        p_private_note: body.privateNote }),
    }, fetcher)
    if (!['escalated', 'dismissed', 'actioned'].includes(status)) throw new Error('invalid_status')
    return reply(200, { reportId: body.reportId, status })
  } catch { return reply(503, { error: 'moderation_unavailable' }) }
}

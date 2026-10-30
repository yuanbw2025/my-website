import { response } from './catalog.js'
import { privateCors } from './cors.js'
import { settings, uidFromToken, adminJson, reviewer, smallJson } from './reports.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const slug = /^[a-z0-9-]{1,100}$/
const reason = /^[a-z][a-z0-9_]{1,39}$/

export async function handleComments(request, fetcher = fetch) {
  const cors = privateCors(request, 'GET, POST')
  if (cors.early) return cors.early
  const reply = (status, body) => cors.apply(response(status, body))
  if (!['GET', 'POST'].includes(request.method)) return reply(405, { error: 'method_not_allowed' })
  const config = settings()
  if (!config) return reply(503, { error: 'comments_unavailable' })
  const url = new URL(request.url)
  const scope = url.searchParams.get('scope')
  if (request.method === 'GET' && scope !== 'queue') {
    const workSlug = url.searchParams.get('slug')
    const offsetText = url.searchParams.get('offset') ?? '0'
    if (!slug.test(workSlug ?? '') || !/^(0|[1-9]\d{0,6})$/.test(offsetText)) {
      return reply(400, { error: 'invalid_page' })
    }
    try {
      const items = await fetcher(new URL('/rest/v1/rpc/community_read_comments', config.base), {
        method: 'POST', headers: { apikey: config.publishable,
          'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ p_slug: workSlug, p_offset: Number(offsetText), p_limit: 50 }),
        signal: AbortSignal.timeout(8000),
      })
      if (!items.ok) throw new Error('read_failed')
      const data = await items.json()
      if (!Array.isArray(data) || data.length > 50 || data.some(item =>
        !uuid.test(item?.id ?? '') || typeof item?.displayName !== 'string' ||
        item.displayName.length > 80 || typeof item?.body !== 'string' ||
        item.body.length > 1200 || typeof item?.createdAt !== 'string')) throw new Error('invalid_data')
      return reply(200, { items: data })
    } catch { return reply(503, { error: 'comments_unavailable' }) }
  }
  let uid
  try { uid = await uidFromToken(config, request.headers.get('authorization'), fetcher) }
  catch { return reply(503, { error: 'auth_unavailable' }) }
  if (!uid) return reply(401, { error: 'authentication_required' })
  try {
    if (request.method === 'GET') {
      if (!await reviewer(config, uid, request.headers.get('authorization'), fetcher)) return reply(403, { error: 'reviewer_required' })
      const items = await adminJson(config,
        '/rest/v1/community_comments?select=id,publication_id,author_uid,display_name,body,status,created_at&status=eq.pending&order=created_at.asc&limit=50', {}, fetcher)
      if (!Array.isArray(items) || items.length > 50) throw new Error('invalid_queue')
      return reply(200, { items })
    }
    const body = await smallJson(request, 6144)
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !slug.test(body.slug ?? '') || !uuid.test(body.idempotencyKey ?? '') ||
        typeof body.displayName !== 'string' || !body.displayName.trim() ||
        body.displayName.length > 80 || typeof body.body !== 'string' ||
        !body.body.trim() || body.body.length > 1200 ||
        new TextEncoder().encode(body.body).byteLength > 4800 ||
        Object.keys(body).some(key => !['slug', 'idempotencyKey', 'displayName', 'body'].includes(key))) {
      return reply(400, { error: 'invalid_comment' })
    }
    const id = await adminJson(config, '/rest/v1/rpc/community_file_comment', {
      method: 'POST', body: JSON.stringify({
        p_author_uid: uid, p_slug: body.slug, p_idempotency_key: body.idempotencyKey,
        p_display_name: body.displayName, p_body: body.body,
      }),
    }, fetcher)
    if (typeof id !== 'string' || !uuid.test(id)) throw new Error('invalid_comment_id')
    return reply(201, { commentId: id, status: 'pending' })
  } catch { return reply(503, { error: 'comments_unavailable' }) }
}

export async function handleCommentDecision(request, fetcher = fetch) {
  const cors = privateCors(request, 'POST')
  if (cors.early) return cors.early
  const reply = (status, body) => cors.apply(response(status, body))
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
  const config = settings()
  if (!config) return reply(503, { error: 'moderation_unavailable' })
  let uid
  try { uid = await uidFromToken(config, request.headers.get('authorization'), fetcher) }
  catch { return reply(503, { error: 'auth_unavailable' }) }
  if (!uid) return reply(401, { error: 'authentication_required' })
  const body = await smallJson(request, 4096)
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !uuid.test(body.commentId ?? '') || !['approve', 'reject', 'take_down'].includes(body.decision) ||
      typeof body.reasonCode !== 'string' || !reason.test(body.reasonCode) ||
      typeof body.privateNote !== 'string' || body.privateNote.length > 2000 ||
      Object.keys(body).some(key => !['commentId', 'decision', 'reasonCode', 'privateNote'].includes(key))) {
    return reply(400, { error: 'invalid_decision' })
  }
  try {
    if (!await reviewer(config, uid, request.headers.get('authorization'), fetcher)) return reply(403, { error: 'reviewer_required' })
    const status = await adminJson(config, '/rest/v1/rpc/community_review_comment', {
      method: 'POST', body: JSON.stringify({
        p_actor_uid: uid, p_comment_id: body.commentId, p_decision: body.decision,
        p_reason_code: body.reasonCode, p_private_note: body.privateNote,
      }),
    }, fetcher)
    if (!['approved', 'rejected', 'taken_down'].includes(status)) throw new Error('invalid_status')
    return reply(200, { commentId: body.commentId, status })
  } catch { return reply(503, { error: 'moderation_unavailable' }) }
}

export async function handleCommentReports(request, fetcher = fetch) {
  const cors = privateCors(request, 'GET, POST')
  if (cors.early) return cors.early
  const reply = (status, body) => cors.apply(response(status, body))
  if (!['GET', 'POST'].includes(request.method)) return reply(405, { error: 'method_not_allowed' })
  const config = settings()
  if (!config) return reply(503, { error: 'reports_unavailable' })
  let uid
  try { uid = await uidFromToken(config, request.headers.get('authorization'), fetcher) }
  catch { return reply(503, { error: 'auth_unavailable' }) }
  if (!uid) return reply(401, { error: 'authentication_required' })
  try {
    if (request.method === 'GET') {
      if (new URL(request.url).searchParams.get('scope') !== 'queue') return reply(400, { error: 'invalid_scope' })
      if (!await reviewer(config, uid, request.headers.get('authorization'), fetcher)) return reply(403, { error: 'reviewer_required' })
      const items = await adminJson(config,
        '/rest/v1/community_comment_reports?select=id,comment_id,reason_code,details,status,created_at&status=eq.open&order=created_at.asc&limit=50', {}, fetcher)
      if (!Array.isArray(items) || items.length > 50) throw new Error('invalid_queue')
      return reply(200, { items })
    }
    const body = await smallJson(request, 4096)
    if (!body || typeof body !== 'object' || Array.isArray(body) || !uuid.test(body.commentId ?? '') ||
        !['child_safety', 'sexual_violence', 'violence_threat', 'hate', 'privacy', 'other'].includes(body.reasonCode) ||
        typeof body.details !== 'string' || body.details.length > 2000 ||
        Object.keys(body).some(key => !['commentId', 'reasonCode', 'details'].includes(key))) {
      return reply(400, { error: 'invalid_report' })
    }
    const id = await adminJson(config, '/rest/v1/rpc/community_file_comment_report', {
      method: 'POST', body: JSON.stringify({ p_reporter_uid: uid, p_comment_id: body.commentId,
        p_reason_code: body.reasonCode, p_details: body.details }),
    }, fetcher)
    if (typeof id !== 'string' || !uuid.test(id)) throw new Error('invalid_report_id')
    return reply(201, { reportId: id, status: 'open' })
  } catch { return reply(503, { error: 'reports_unavailable' }) }
}

export async function handleCommentReportDecision(request, fetcher = fetch) {
  const cors = privateCors(request, 'POST')
  if (cors.early) return cors.early
  const reply = (status, body) => cors.apply(response(status, body))
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
  const config = settings()
  if (!config) return reply(503, { error: 'moderation_unavailable' })
  let uid
  try { uid = await uidFromToken(config, request.headers.get('authorization'), fetcher) }
  catch { return reply(503, { error: 'auth_unavailable' }) }
  if (!uid) return reply(401, { error: 'authentication_required' })
  const body = await smallJson(request, 4096)
  if (!body || typeof body !== 'object' || Array.isArray(body) || !uuid.test(body.reportId ?? '') ||
      !['dismiss', 'take_down'].includes(body.decision) ||
      typeof body.reasonCode !== 'string' || !reason.test(body.reasonCode) ||
      typeof body.privateNote !== 'string' || body.privateNote.length > 2000 ||
      Object.keys(body).some(key => !['reportId', 'decision', 'reasonCode', 'privateNote'].includes(key))) {
    return reply(400, { error: 'invalid_decision' })
  }
  try {
    if (!await reviewer(config, uid, request.headers.get('authorization'), fetcher)) return reply(403, { error: 'reviewer_required' })
    const status = await adminJson(config, '/rest/v1/rpc/community_review_comment_report', {
      method: 'POST', body: JSON.stringify({ p_actor_uid: uid, p_report_id: body.reportId,
        p_decision: body.decision, p_reason_code: body.reasonCode, p_private_note: body.privateNote }),
    }, fetcher)
    if (!['dismissed', 'actioned'].includes(status)) throw new Error('invalid_status')
    return reply(200, { reportId: body.reportId, status })
  } catch { return reply(503, { error: 'moderation_unavailable' }) }
}

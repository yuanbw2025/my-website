import { response } from './catalog.js'
import { privateCors } from './cors.js'
import { settings, uidFromToken, adminJson, smallJson, reviewer } from './reports.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const digest = /^[0-9a-f]{64}$/

async function ownerRequest(request, methods, run, fetcher) {
  const cors = privateCors(request, methods)
  if (cors.early) return cors.early
  const reply = (status, body) => cors.apply(response(status, body))
  const config = settings()
  if (!config) return reply(503, { error: 'owner_service_unavailable' })
  let uid
  try { uid = await uidFromToken(config, request.headers.get('authorization'), fetcher) }
  catch { return reply(503, { error: 'auth_unavailable' }) }
  if (!uid) return reply(401, { error: 'authentication_required' })
  return run(config, uid, reply)
}

export async function handleMySubmissions(request, fetcher = fetch) {
  if (request.method !== 'GET') return response(405, { error: 'method_not_allowed' })
  return ownerRequest(request, 'GET', async (config, _uid, reply) => {
    try {
      const url = new URL('/rest/v1/community_submissions', config.base)
      url.searchParams.set('select', 'id,kind,status,sha256,created_at,updated_at')
      url.searchParams.set('order', 'created_at.desc')
      url.searchParams.set('limit', '50')
      const upstream = await fetcher(url, { headers: { apikey: config.publishable,
        Authorization: request.headers.get('authorization'), Accept: 'application/json' },
      signal: AbortSignal.timeout(8000) })
      if (!upstream.ok) throw new Error('read_failed')
      const items = await upstream.json()
      if (!Array.isArray(items) || items.length > 50 || items.some(item =>
        !uuid.test(item?.id ?? '') || !digest.test(item?.sha256 ?? '') ||
        typeof item?.status !== 'string' || typeof item?.kind !== 'string')) throw new Error('invalid_data')
      return reply(200, { items })
    } catch { return reply(503, { error: 'owner_service_unavailable' }) }
  }, fetcher)
}

export async function handleSubmissionAction(request, fetcher = fetch) {
  if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' })
  return ownerRequest(request, 'POST', async (config, uid, reply) => {
    const body = await smallJson(request, 4096)
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !uuid.test(body.submissionId ?? '') || !digest.test(body.revisionSha256 ?? '') ||
        !['withdraw', 'appeal'].includes(body.action) ||
        (body.action === 'appeal' && (typeof body.reason !== 'string' ||
          !body.reason.trim() || body.reason.length > 2000)) ||
        (body.action === 'withdraw' && body.reason !== undefined) ||
        Object.keys(body).some(key => !['submissionId', 'revisionSha256', 'action', 'reason'].includes(key))) {
      return reply(400, { error: 'invalid_action' })
    }
    try {
      if (body.action === 'withdraw') {
        const status = await adminJson(config, '/rest/v1/rpc/community_owner_withdraw', {
          method: 'POST', body: JSON.stringify({ p_owner_uid: uid,
            p_submission_id: body.submissionId, p_revision_sha256: body.revisionSha256 }),
        }, fetcher)
        if (status !== 'withdrawn') throw new Error('invalid_status')
        return reply(200, { submissionId: body.submissionId, status })
      }
      const id = await adminJson(config, '/rest/v1/rpc/community_file_appeal', {
        method: 'POST', body: JSON.stringify({ p_owner_uid: uid,
          p_submission_id: body.submissionId, p_revision_sha256: body.revisionSha256,
          p_reason: body.reason }),
      }, fetcher)
      if (typeof id !== 'string' || !uuid.test(id)) throw new Error('invalid_appeal_id')
      return reply(201, { appealId: id, status: 'open' })
    } catch { return reply(503, { error: 'owner_action_unavailable' }) }
  }, fetcher)
}

export async function handleAppeals(request, fetcher = fetch) {
  if (request.method !== 'GET') return response(405, { error: 'method_not_allowed' })
  return ownerRequest(request, 'GET', async (config, uid, reply) => {
    try {
      const queue = new URL(request.url).searchParams.get('scope') === 'queue'
      if (queue) {
        if (!await reviewer(config, uid, request.headers.get('authorization'), fetcher)) {
          return reply(403, { error: 'reviewer_required' })
        }
        const items = await adminJson(config,
          '/rest/v1/community_appeals?select=id,submission_id,owner_uid,revision_sha256,from_status,reason,status,created_at,community_submissions!inner(kind)&status=eq.open&order=created_at.asc&limit=50', {}, fetcher)
        if (!Array.isArray(items) || items.length > 50) throw new Error('invalid_data')
        return reply(200, { items })
      }
      const upstream = await fetcher(new URL(
        '/rest/v1/community_appeals?select=id,submission_id,from_status,reason,status,reviewer_note,created_at,reviewed_at&order=created_at.desc&limit=50',
        config.base), { headers: { apikey: config.publishable,
          Authorization: request.headers.get('authorization'), Accept: 'application/json' },
        signal: AbortSignal.timeout(8000) })
      if (!upstream.ok) throw new Error('read_failed')
      const items = await upstream.json()
      if (!Array.isArray(items) || items.length > 50) throw new Error('invalid_data')
      return reply(200, { items })
    } catch { return reply(503, { error: 'appeals_unavailable' }) }
  }, fetcher)
}

export async function handleAppealDecision(request, fetcher = fetch) {
  if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' })
  return ownerRequest(request, 'POST', async (config, uid, reply) => {
    const body = await smallJson(request, 4096)
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !uuid.test(body.appealId ?? '') || !['upheld', 'denied'].includes(body.decision) ||
        typeof body.reviewerNote !== 'string' || !body.reviewerNote.trim() ||
        body.reviewerNote.length > 2000 ||
        Object.keys(body).some(key => !['appealId', 'decision', 'reviewerNote'].includes(key))) {
      return reply(400, { error: 'invalid_decision' })
    }
    try {
      if (!await reviewer(config, uid, request.headers.get('authorization'), fetcher)) {
        return reply(403, { error: 'reviewer_required' })
      }
      const status = await adminJson(config, '/rest/v1/rpc/community_review_appeal', {
        method: 'POST', body: JSON.stringify({ p_actor_uid: uid, p_appeal_id: body.appealId,
          p_decision: body.decision, p_reviewer_note: body.reviewerNote }),
      }, fetcher)
      if (!['upheld', 'denied'].includes(status)) throw new Error('invalid_status')
      return reply(200, { appealId: body.appealId, status })
    } catch { return reply(503, { error: 'appeal_review_unavailable' }) }
  }, fetcher)
}

import { createHash } from 'node:crypto'
import { response, readPart } from './catalog.js'
import { privateCors } from './cors.js'
import { settings, uidFromToken, smallJson } from './reports.js'
import { anchorShape, readingBlocks, validateAnchor } from '../../shared/anchors.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const slug = /^[a-z0-9-]{1,100}$/
const int = (n, max = 10000000) => Number.isSafeInteger(n) && n >= 0 && n <= max
const exact = (body, keys) => body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).every(key => keys.includes(key))
const hash = text => createHash('sha256').update(text).digest('hex')

async function rpc(config, name, args, fetcher) {
  const result = await fetcher(new URL(`/rest/v1/rpc/${name}`, config.base), {
    method: 'POST', headers: { apikey: config.secret, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(10000),
  })
  if (!result.ok) {
    const error = await result.json().catch(() => ({}))
    if (error.message === 'social_capacity_limit') return {error:'social_capacity_limit'}
    if (error.message === 'comment_rate_limited') return { error: 'daily_comment_limit' }
    throw new Error('social_unavailable')
  }
  return result.json()
}

async function section(slugValue, data, fetcher) {
  const result = await readPart({ slug: slugValue, section: String(data.section), entry: String(data.entry), part: '0' }, fetcher, true)
  if (!result.ok) return null
  return result.json()
}

function resultStatus(data) {
  if (!data?.error) return 200
  if (['daily_comment_limit'].includes(data.error)) return 429
  if (['authentication_required'].includes(data.error)) return 401
  if (['work_not_available','comment_not_found','submission_not_found'].includes(data.error)) return 404
  return 409
}

export async function handleSocial(request, fetcher = fetch) {
  const cors = privateCors(request, 'GET, POST')
  if (cors.early) return cors.early
  const reply = (status, body) => cors.apply(response(status, body))
  if (!['GET','POST'].includes(request.method)) return reply(405, { error: 'method_not_allowed' })
  const config = settings()
  if (!config) return reply(503, { error: 'social_unavailable' })
  const url = new URL(request.url)
  let uid = null
  try {
    const authorization = request.headers.get('authorization')
    if (authorization) {
      uid = await uidFromToken(config, authorization, fetcher)
      if (!uid) return reply(401, { error: 'authentication_required' })
    }
    if (request.method === 'GET') {
      const scope = url.searchParams.get('scope') ?? 'work'
      let data
      if (scope === 'work') {
        if (!slug.test(url.searchParams.get('slug') ?? '')) return reply(400, { error: 'invalid_slug' })
        data = await rpc(config, 'community_social_state', { p_slug: url.searchParams.get('slug'), p_actor_uid: uid }, fetcher)
      } else {
        if (!uid) return reply(401, { error: 'authentication_required' })
        const offset = url.searchParams.get('offset') ?? '0'
        if (!['wallet','shelf','notifications','blocks','owned','assignments'].includes(scope) || !/^(0|[1-9]\d{0,5}|1000000)$/.test(offset)) return reply(400, { error: 'invalid_page' })
        data = await rpc(config, 'community_social_private', { p_actor_uid: uid, p_scope: scope, p_offset: Number(offset) }, fetcher)
      }
      return reply(resultStatus(data), data)
    }
    if (!uid) return reply(401, { error: 'authentication_required' })
    const body = await smallJson(request, 4096)
    if (!exact(body, ['action','slug','value','idempotencyKey','amount','data']) || typeof body.action !== 'string') return reply(400, { error: 'invalid_action' })
    const { action, data = {} } = body
    if (process.env.COMMUNITY_SOCIAL_WRITES_PAUSED === '1' && !['unsave','unblock','read-notification','withdraw-comment'].includes(action)) return reply(409,{error:'social_paused'})
    if (['like','save','follow','gift','progress'].includes(action) && !slug.test(body.slug ?? '')) return reply(400, { error: 'invalid_slug' })
    if (['like','save','follow'].includes(action) && typeof body.value !== 'boolean') return reply(400, { error: 'invalid_value' })
    if (['claim','gift'].includes(action) && !uuid.test(body.idempotencyKey ?? '')) return reply(400, { error: 'invalid_key' })
    if (action === 'gift' && (!int(body.amount, 3) || body.amount < 1)) return reply(400, { error: 'invalid_amount' })
    let result
    if (action === 'choose-work') {
      if (!exact(data, ['submissionId','workId']) || !uuid.test(data.submissionId ?? '') || (data.workId !== null && !uuid.test(data.workId ?? ''))) return reply(400, { error: 'invalid_work' })
      result = await rpc(config, 'community_choose_work', { p_actor_uid: uid, p_submission_id: data.submissionId, p_work_id: data.workId }, fetcher)
    } else if (action === 'withdraw-comment') {
      if (!exact(data, ['commentId']) || !uuid.test(data.commentId ?? '')) return reply(400, { error: 'invalid_comment' })
      result = await rpc(config, 'community_withdraw_comment', { p_actor_uid: uid, p_comment_id: data.commentId }, fetcher)
    } else {
      const idField = { block: 'commentId', unblock: 'blockId', unsave: 'workId', 'read-notification': 'notificationId' }[action]
      if (idField && (!exact(data, [idField]) || !uuid.test(data[idField] ?? ''))) return reply(400, { error: 'invalid_action' })
      if (action === 'progress') {
        if (!exact(data, ['revisionId','section','entry','block']) || !uuid.test(data.revisionId ?? '') ||
          !int(data.section) || !int(data.entry) || !int(data.block)) return reply(400, { error: 'invalid_progress' })
        const document = await section(body.slug, data, fetcher)
        if (!document || document.revisionId !== data.revisionId || data.block >= Math.max(1, readingBlocks(document.text).length)) return reply(409, { error: 'invalid_progress' })
      }
      if (!['like','save','follow','claim','gift','progress','block','unblock','unsave','read-notification'].includes(action)) return reply(400, { error: 'invalid_action' })
      result = await rpc(config, 'community_social_action', { p_actor_uid: uid, p_action: action,
        p_slug: body.slug ?? null, p_value: body.value ?? null, p_key: body.idempotencyKey ?? null,
        p_amount: body.amount ?? null, p_data: data }, fetcher)
    }
    return reply(resultStatus(result), result)
  } catch { return reply(503, { error: 'social_unavailable' }) }
}

export async function handleConversation(request, fetcher = fetch) {
  const cors = privateCors(request, 'GET, POST')
  if (cors.early) return cors.early
  const reply = (status, body) => cors.apply(response(status, body))
  if (!['GET','POST'].includes(request.method)) return reply(405, { error: 'method_not_allowed' })
  const config = settings()
  if (!config) return reply(503, { error: 'comments_unavailable' })
  let uid = null
  try {
    const authorization = request.headers.get('authorization')
    if (authorization) {
      uid = await uidFromToken(config, authorization, fetcher)
      if (!uid) return reply(401, { error: 'authentication_required' })
    }
    if (request.method === 'GET') {
      const q = new URL(request.url).searchParams
      const offset = q.get('offset') ?? '0'
      const parent = q.get('parent')
      if (!slug.test(q.get('slug') ?? '') || !/^(0|[1-9]\d{0,5}|1000000)$/.test(offset) || (parent !== null && !uuid.test(parent))) return reply(400, { error: 'invalid_page' })
      const filter = {}
      if (q.has('commentId')) { if(!uuid.test(q.get('commentId'))) return reply(400,{error:'invalid_filter'}); filter.commentId=q.get('commentId') }
      for (const key of ['section','entry','block']) if (q.has(key)) {
        if (!/^(0|[1-9]\d{0,7})$/.test(q.get(key)) || !int(Number(q.get(key)))) return reply(400, { error: 'invalid_filter' })
        filter[key] = Number(q.get(key))
      }
      if (('section' in filter) !== ('entry' in filter) || ('block' in filter && !('section' in filter))) return reply(400, { error: 'invalid_filter' })
      const data = await rpc(config, 'community_conversation', { p_slug: q.get('slug'), p_actor_uid: uid,
        p_filter: filter, p_parent: parent, p_offset: Number(offset) }, fetcher)
      return reply(resultStatus(data), data)
    }
    if (!uid) return reply(401, { error: 'authentication_required' })
    if (process.env.COMMUNITY_SOCIAL_WRITES_PAUSED === '1') return reply(409,{error:'social_paused'})
    const body = await smallJson(request, 12288)
    if (!exact(body, ['slug','idempotencyKey','displayName','body','anchor','parentId']) ||
      !slug.test(body.slug ?? '') || !uuid.test(body.idempotencyKey ?? '') ||
      typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 80 ||
      typeof body.body !== 'string' || !body.body.trim() || body.body.length > 1200 || Buffer.byteLength(body.body) > 4800 ||
      (body.parentId != null && !uuid.test(body.parentId)) || (body.anchor != null && !anchorShape(body.anchor))) return reply(400, { error: 'invalid_comment' })
    if (body.anchor) {
      const doc = await section(body.slug, body.anchor, fetcher)
      if (!doc || !await validateAnchor(body.anchor, doc.text, doc.revisionId, doc.revisionHash, hash)) return reply(409, { error: 'anchor_mismatch' })
    }
    const data = await rpc(config, 'community_file_comment_v2', { p_author_uid: uid, p_slug: body.slug,
      p_idempotency_key: body.idempotencyKey, p_display_name: body.displayName, p_body: body.body,
      p_anchor: body.anchor ?? null, p_parent: body.parentId ?? null }, fetcher)
    return reply(resultStatus(data) === 200 ? 201 : resultStatus(data), data)
  } catch { return reply(503, { error: 'comments_unavailable' }) }
}

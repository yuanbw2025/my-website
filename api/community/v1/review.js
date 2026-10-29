import { response } from '../_lib/catalog.js'
import { privateCors } from '../_lib/cors.js'

/** Small control proxy. The private 32 MiB manuscript never crosses Vercel Functions. */
export default {
  async fetch(request) {
    const cors = privateCors(request, 'GET, POST')
    if (cors.early) return cors.early
    const reply = (status, body) => cors.apply(response(status, body))
    if (!['GET', 'POST'].includes(request.method)) return reply(405, { error: 'method_not_allowed' })
    const base = process.env.COMMUNITY_SUPABASE_URL
    const key = process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY
    if (!base || !key) return reply(503, { error: 'moderation_unavailable' })
    const authorization = request.headers.get('authorization')
    if (!authorization || !/^Bearer [A-Za-z0-9._-]{40,}$/.test(authorization)) {
      return reply(401, { error: 'authentication_required' })
    }
    const submissionId = new URL(request.url).searchParams.get('id')
    if (submissionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(submissionId)) {
      return reply(400, { error: 'invalid_submission_id' })
    }
    if (request.method === 'POST' && !submissionId) return reply(400, { error: 'invalid_submission_id' })
    if (Number(request.headers.get('content-length') ?? 0) > 8192) return reply(413, { error: 'request_too_large' })
    let payload
    if (request.method === 'POST') {
      try { payload = await request.text() } catch { return reply(400, { error: 'invalid_request' }) }
      if (new TextEncoder().encode(payload).byteLength > 8192) return reply(413, { error: 'request_too_large' })
    }
    try {
      const url = new URL('/functions/v1/review-submission', base)
      if (url.protocol !== 'https:' || url.username || url.password) return reply(503, { error: 'moderation_unavailable' })
      if (submissionId) url.searchParams.set('submissionId', submissionId)
      const upstream = await fetch(url, {
        method: request.method,
        headers: { apikey: key, Authorization: authorization,
          ...(payload ? { 'Content-Type': 'application/json' } : {}) },
        body: payload, signal: AbortSignal.timeout(60000),
      })
      const body = await upstream.json()
      if (!body || typeof body !== 'object') return reply(502, { error: 'invalid_moderation_response' })
      return reply(upstream.status, body)
    } catch { return reply(503, { error: 'moderation_unavailable' }) }
  },
}

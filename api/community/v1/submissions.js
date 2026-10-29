import { response } from '../_lib/catalog.js'
import { privateCors } from '../_lib/cors.js'
import { boundedText } from '../_lib/bounded-text.js'

export default {
  async fetch(request) {
    const cors = privateCors(request, 'POST')
    if (cors.early) return cors.early
    const reply = (status, body) => cors.apply(response(status, body))
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
    const base = process.env.COMMUNITY_SUPABASE_URL
    const key = process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY
    if (!base || !key) return reply(503, { error: 'submission_unavailable' })
    const authorization = request.headers.get('authorization')
    if (!authorization || !/^Bearer [A-Za-z0-9._-]{40,}$/.test(authorization)) {
      return reply(401, { error: 'authentication_required' })
    }
    if (Number(request.headers.get('content-length') ?? 0) > 4096) return reply(413, { error: 'request_too_large' })
    let payload
    try { payload = await boundedText(request, 4096) } catch { return reply(400, { error: 'invalid_request' }) }
    if (payload === null) return reply(413, { error: 'request_too_large' })
    try {
      const url = new URL('/functions/v1/verify-submission', base)
      if (url.protocol !== 'https:') return reply(503, { error: 'submission_unavailable' })
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(45000),
      })
      const body = await upstream.json()
      if (!body || typeof body !== 'object') return reply(502, { error: 'invalid_submission_response' })
      return reply(upstream.status, body)
    } catch {
      return reply(503, { error: 'submission_unavailable' })
    }
  },
}

import { response } from '../_lib/catalog.js'
import { privateCors } from '../_lib/cors.js'

export default {
  async fetch(request) {
    const cors = privateCors(request, 'GET')
    if (cors.early) return cors.early
    const reply = (status, body) => cors.apply(response(status, body))
    if (request.method !== 'GET') return reply(405, { error: 'method_not_allowed' })
    const id = new URL(request.url).searchParams.get('id')
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
      return reply(400, { error: 'invalid_submission_id' })
    }
    const base = process.env.COMMUNITY_SUPABASE_URL
    const key = process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY
    if (!base || !key) return reply(503, { error: 'status_unavailable' })
    const authorization = request.headers.get('authorization')
    if (!authorization || !/^Bearer [A-Za-z0-9._-]{40,}$/.test(authorization)) {
      return reply(401, { error: 'authentication_required' })
    }
    try {
      const url = new URL('/rest/v1/community_submissions', base)
      if (url.protocol !== 'https:') return reply(503, { error: 'status_unavailable' })
      url.searchParams.set('select', 'id,kind,status,created_at,updated_at')
      url.searchParams.set('id', `eq.${id}`)
      url.searchParams.set('limit', '1')
      const upstream = await fetch(url, {
        headers: { apikey: key, Authorization: authorization, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (!upstream.ok) return reply(503, { error: 'status_unavailable' })
      const rows = await upstream.json()
      if (!Array.isArray(rows) || rows.length > 1) return reply(502, { error: 'invalid_status_data' })
      if (!rows.length) return reply(404, { error: 'submission_not_found' })
      const row = rows[0]
      if (row.id !== id || typeof row.status !== 'string') return reply(502, { error: 'invalid_status_data' })
      return reply(200, { submissionId: row.id, kind: row.kind, status: row.status,
        createdAt: row.created_at, updatedAt: row.updated_at })
    } catch { return reply(503, { error: 'status_unavailable' }) }
  },
}

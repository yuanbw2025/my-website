import { timingSafeEqual } from 'node:crypto'
import { response } from './catalog.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function authorized(request) {
  const secret = process.env.CRON_SECRET ?? ''
  const candidate = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  return secret.length >= 16 && candidate.length === expected.length &&
    timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))
}

function settings() {
  const base = process.env.COMMUNITY_SUPABASE_URL
  const secret = process.env.COMMUNITY_SUPABASE_SECRET_KEY
  if (!base || !secret) return null
  try {
    const url = new URL(base)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
    return { base: url, secret }
  } catch { return null }
}

async function dbJson(config, path, fetcher, options = {}) {
  const result = await fetcher(new URL(path, config.base), {
    ...options,
    headers: { apikey: config.secret, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(10000),
  })
  if (!result.ok) throw new Error('cleanup_database_unavailable')
  return result.json()
}

/** Delete unsubmitted Storage objects after 48 hours and record the purge. */
export async function cleanupExpiredIntake(request, { fetcher = fetch } = {}) {
  if (request.method !== 'GET') return response(405, { error: 'method_not_allowed' })
  if (!authorized(request)) return response(401, { error: 'authentication_required' })
  const config = settings()
  if (!config) return response(503, { error: 'cleanup_unavailable' })
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  try {
    const path = `/rest/v1/community_upload_sessions?select=id,owner_uid,object_path&status=in.(created,failed,expired)&purged_at=is.null&created_at=lt.${encodeURIComponent(cutoff)}&order=created_at.asc&limit=25`
    const sessions = await dbJson(config, path, fetcher)
    if (!Array.isArray(sessions)) throw new Error('invalid_cleanup_rows')
    let purged = 0
    for (const row of sessions) {
      if (!UUID.test(row?.id ?? '') || !UUID.test(row?.owner_uid ?? '') ||
          row.object_path !== `${row.owner_uid}/${row.id}/snapshot.json`) {
        throw new Error('invalid_cleanup_row')
      }
      const submissions = await dbJson(config,
        `/rest/v1/community_submissions?select=id&upload_session_id=eq.${row.id}&limit=1`, fetcher)
      if (!Array.isArray(submissions)) throw new Error('invalid_submission_rows')
      if (submissions.length) continue
      const removed = await fetcher(new URL('/storage/v1/object/community-intake', config.base), {
        method: 'DELETE',
        headers: { apikey: config.secret, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [row.object_path] }),
        signal: AbortSignal.timeout(10000),
      })
      if (!removed.ok) throw new Error('cleanup_storage_unavailable')
      const updated = await dbJson(config, `/rest/v1/community_upload_sessions?id=eq.${row.id}&purged_at=is.null`, fetcher, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'expired', purged_at: new Date().toISOString() }),
      })
      if (!Array.isArray(updated) || updated.length !== 1 || updated[0].id !== row.id) {
        throw new Error('cleanup_receipt_missing')
      }
      purged++
    }
    return response(200, { scanned: sessions.length, purged })
  } catch {
    return response(503, { error: 'cleanup_unavailable' })
  }
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { handleMySubmissions, handleSubmissionAction, handleAppeals, handleAppealDecision } from '../server/_lib/owner.js'

for (const [route, handler, method] of [
  ['my-submissions', handleMySubmissions, 'GET'],
  ['submission-action', handleSubmissionAction, 'POST'],
  ['appeals', handleAppeals, 'GET'],
  ['appeal-decision', handleAppealDecision, 'POST'],
]) {
  test(`${route}: native preflight precedes method/auth checks without granting data access`, async () => {
    process.env.COMMUNITY_ALLOWED_ORIGINS = 'http://localhost:17831,https://localhost'
    process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
    process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
    process.env.COMMUNITY_SUPABASE_SECRET_KEY = 'sb_secret_test'
    const fetcher = () => { throw new Error('preflight or unauthenticated request must not query private data') }
    const request = (verb, origin) => new Request(`https://gallery.example/api/community/v1/${route}`, {
      method: verb, headers: { Origin: origin, 'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': 'authorization,content-type' },
    })
    for (const origin of ['http://localhost:17831', 'https://localhost']) {
      const preflight = await handler(request('OPTIONS', origin), fetcher)
      assert.equal(preflight.status, 204)
      assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin)
      assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), `${method}, OPTIONS`)
      assert.equal(await preflight.text(), '')
      const unauthenticated = await handler(request(method, origin), fetcher)
      assert.equal(unauthenticated.status, 401)
      assert.equal(unauthenticated.headers.get('Access-Control-Allow-Origin'), origin)
      const invalidMethod = await handler(request('DELETE', origin), fetcher)
      assert.equal(invalidMethod.status, 405)
      assert.equal(invalidMethod.headers.get('Access-Control-Allow-Origin'), origin)
    }
    for (const verb of ['OPTIONS', method]) {
      const foreign = await handler(request(verb, 'https://unapproved.example'), fetcher)
      assert.equal(foreign.status, 403)
      assert.equal(foreign.headers.get('Access-Control-Allow-Origin'), null)
    }
  })
}

import test from 'node:test'
import assert from 'node:assert/strict'
import uploadRoute from '../../api/community/v1/upload-sessions.js'
import submissionRoute from '../../api/community/v1/submissions.js'
import statusRoute from '../../api/community/v1/submission-status.js'

const token = `Bearer ${'x'.repeat(80)}`
const origin = 'https://storyforge-lab.com'
const id = '11111111-1111-4111-8111-111111111111'

test('private routes reject unlisted browser origins before side effects', async () => {
  process.env.COMMUNITY_ALLOWED_ORIGINS = origin
  const request = new Request('https://example.vercel.app/api/community/v1/upload-sessions', {
    method: 'POST', headers: { Origin: 'https://hostile.example' },
  })
  assert.equal((await uploadRoute.fetch(request)).status, 403)
  assert.equal((await submissionRoute.fetch(request)).status, 403)
})

test('allowed origin receives a bounded preflight response', async () => {
  process.env.COMMUNITY_ALLOWED_ORIGINS = origin
  const request = new Request('https://example.vercel.app/api/community/v1/upload-sessions', {
    method: 'OPTIONS', headers: { Origin: origin },
  })
  const result = await uploadRoute.fetch(request)
  assert.equal(result.status, 204)
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin)
  assert.equal(result.headers.get('Access-Control-Allow-Headers'), 'Authorization, Content-Type')
})

test('submission proxy forwards only small authenticated control data', async () => {
  process.env.COMMUNITY_ALLOWED_ORIGINS = origin
  process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    assert.equal(url.pathname, '/functions/v1/verify-submission')
    assert.equal(options.headers.apikey, 'sb_publishable_test')
    assert.equal(options.headers.Authorization, token)
    assert.equal(JSON.parse(options.body).sessionId, id)
    return Response.json({ submissionId: id, status: 'submitted' }, { status: 201 })
  }
  try {
    const result = await submissionRoute.fetch(new Request('https://example.vercel.app/api/community/v1/submissions', {
      method: 'POST', headers: { Origin: origin, Authorization: token },
      body: JSON.stringify({ sessionId: id, rightsConfirmed: true }),
    }))
    assert.equal(result.status, 201)
    assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin)
    assert.equal((await result.json()).status, 'submitted')
  } finally { globalThis.fetch = originalFetch }
})

test('owner status route returns no other submission when RLS gives an empty result', async () => {
  process.env.COMMUNITY_ALLOWED_ORIGINS = origin
  process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    assert.equal(url.searchParams.get('id'), `eq.${id}`)
    assert.equal(options.headers.Authorization, token)
    return Response.json([])
  }
  try {
    const result = await statusRoute.fetch(new Request(`https://example.vercel.app/api/community/v1/submission-status?id=${id}`, {
      headers: { Origin: origin, Authorization: token },
    }))
    assert.equal(result.status, 404)
    assert.equal((await result.json()).error, 'submission_not_found')
  } finally { globalThis.fetch = originalFetch }
})

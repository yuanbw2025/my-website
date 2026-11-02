import test from 'node:test'
import assert from 'node:assert/strict'
import { handleReports, handleReportDecision, reviewerSessionAal2 } from '../server/_lib/reports.js'
import { reviewerToken } from './reviewer-token.mjs'

const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const reportId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const token = reviewerToken(uid)

function configured() {
  process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  process.env.COMMUNITY_SUPABASE_SECRET_KEY = 'sb_secret_test'
  process.env.COMMUNITY_ALLOWED_ORIGINS = 'https://example.com'
}

test('report filing authenticates and stores only bounded metadata', async () => {
  configured()
  const calls = []
  const request = new Request('https://example.com/api/community/v1/reports', {
    method: 'POST', headers: { Authorization: token, Origin: 'https://example.com' },
    body: JSON.stringify({ slug: 'approved-story', reasonCode: 'child_safety', details: '请人工复核' }),
  })
  const result = await handleReports(request, async (url, options) => {
    calls.push({ path: url.pathname, options })
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: uid }), { status: 200 })
    assert.equal(url.pathname, '/rest/v1/rpc/community_file_report')
    assert.equal(options.headers.apikey, 'sb_secret_test')
    const payload = JSON.parse(options.body)
    assert.equal(payload.p_reporter_uid, uid)
    assert.equal(payload.p_details, '请人工复核')
    return new Response(JSON.stringify(reportId), { status: 200 })
  })
  assert.equal(result.status, 201)
  assert.equal((await result.json()).reportId, reportId)
  assert.deepEqual(calls.map(call => call.path), ['/auth/v1/user', '/rest/v1/rpc/community_file_report'])
})

test('report route refuses unauthenticated and unlisted browser origins', async () => {
  configured()
  const request = new Request('https://example.com/api/community/v1/reports', {
    method: 'POST', body: '{}', headers: { Origin: 'https://evil.example' },
  })
  assert.equal((await handleReports(request)).status, 403)
  assert.equal((await handleReports(new Request('https://example.com/api/community/v1/reports', {
    method: 'POST', body: '{}',
  }))).status, 401)
})

test('only an active reviewer can decide a report', async () => {
  configured()
  const request = () => new Request('https://example.com/api/community/v1/report-decision', {
    method: 'POST', headers: { Authorization: token },
    body: JSON.stringify({ reportId, decision: 'take_down', reasonCode: 'confirmed_harm', privateNote: '内部记录' }),
  })
  const noReviewer = await handleReportDecision(request(), async url => {
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: uid }), { status: 200 })
    return new Response('[]', { status: 200 })
  })
  assert.equal(noReviewer.status, 403)
  const allowed = await handleReportDecision(request(), async (url, options) => {
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: uid }), { status: 200 })
    if (url.pathname === '/rest/v1/community_reviewers') return new Response('[{"uid":"' + uid + '"}]', { status: 200 })
    assert.equal(url.pathname, '/rest/v1/rpc/community_review_report')
    assert.equal(JSON.parse(options.body).p_decision, 'take_down')
    return new Response('"actioned"', { status: 200 })
  })
  assert.equal(allowed.status, 200)
  assert.equal((await allowed.json()).status, 'actioned')
})

test('a verified first-factor session cannot enter the reviewer queue or decide a report', async () => {
  configured()
  let membershipReads = 0
  const fetcher = async url => {
    if (url.pathname === '/auth/v1/user') return Response.json({ id: uid })
    membershipReads++
    throw new Error('first-factor session must stop before reviewer lookup')
  }
  const firstFactor = reviewerToken(uid, 'aal1')
  const queue = await handleReports(new Request('https://example.com/api/community/v1/reports?scope=queue', {
    headers: { Authorization: firstFactor },
  }), fetcher)
  assert.equal(queue.status, 403)
  const decision = await handleReportDecision(new Request('https://example.com/api/community/v1/report-decision', {
    method: 'POST', headers: { Authorization: firstFactor },
    body: JSON.stringify({ reportId, decision: 'take_down', reasonCode: 'confirmed_harm', privateNote: '' }),
  }), fetcher)
  assert.equal(decision.status, 403)
  assert.equal(membershipReads, 0)
})

test('reviewer sessions reject a mismatched subject, expired token, and malformed claims', () => {
  assert.equal(reviewerSessionAal2(reviewerToken(uid), uid), true)
  assert.equal(reviewerSessionAal2(reviewerToken(uid), reportId), false)
  assert.equal(reviewerSessionAal2(reviewerToken(uid, 'aal1'), uid), false)
  assert.equal(reviewerSessionAal2(reviewerToken(uid, 'aal2', 1), uid), false)
  assert.equal(reviewerSessionAal2('Bearer a.b.c', uid), false)
})

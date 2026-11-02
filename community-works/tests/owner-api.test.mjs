import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewerToken } from './reviewer-token.mjs'
import { handleMySubmissions, handleSubmissionAction, handleAppeals, handleAppealDecision } from '../server/_lib/owner.js'

const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const submissionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const appealId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const token = reviewerToken(uid)
const sha256 = 'b'.repeat(64)
function configured() {
  process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  process.env.COMMUNITY_SUPABASE_SECRET_KEY = 'sb_secret_test'
  process.env.COMMUNITY_ALLOWED_ORIGINS = 'https://example.com'
}
const auth = async url => url.pathname === '/auth/v1/user'
  ? new Response(JSON.stringify({ id: uid }), { status: 200 }) : null

test('my submissions are read with the user token and RLS, never service role', async () => {
  configured()
  const result = await handleMySubmissions(new Request('https://example.com/api/community/v1/my-submissions', {
    headers: { Authorization: token },
  }), async (url, options) => {
    const user = await auth(url)
    if (user) return user
    assert.equal(url.pathname, '/rest/v1/community_submissions')
    assert.equal(options.headers.apikey, 'sb_publishable_test')
    assert.equal(options.headers.Authorization, token)
    return new Response(JSON.stringify([{ id: submissionId, kind: 'novel', status: 'submitted', sha256 }]), { status: 200 })
  })
  assert.equal(result.status, 200)
  assert.equal((await result.json()).items.length, 1)
})

test('withdraw and appeal pass the authenticated author into service-only transactions', async () => {
  configured()
  const action = (value) => new Request('https://example.com/api/community/v1/submission-action', {
    method: 'POST', headers: { Authorization: token }, body: JSON.stringify(value),
  })
  const withdraw = await handleSubmissionAction(action({ submissionId, revisionSha256: sha256,
    action: 'withdraw' }), async (url, options) => {
    const user = await auth(url)
    if (user) return user
    assert.equal(url.pathname, '/rest/v1/rpc/community_owner_withdraw')
    assert.equal(JSON.parse(options.body).p_owner_uid, uid)
    return new Response('"withdrawn"', { status: 200 })
  })
  assert.equal(withdraw.status, 200)
  const appeal = await handleSubmissionAction(action({ submissionId, revisionSha256: sha256,
    action: 'appeal', reason: '请复核' }), async (url, options) => {
    const user = await auth(url)
    if (user) return user
    assert.equal(url.pathname, '/rest/v1/rpc/community_file_appeal')
    assert.equal(JSON.parse(options.body).p_reason, '请复核')
    return new Response(JSON.stringify(appealId), { status: 200 })
  })
  assert.equal(appeal.status, 201)
})

test('appeal queue and decisions require active reviewer membership', async () => {
  configured()
  const queue = new Request('https://example.com/api/community/v1/appeals?scope=queue', {
    headers: { Authorization: token },
  })
  const denied = await handleAppeals(queue, async url => {
    const user = await auth(url)
    return user ?? new Response('[]', { status: 200 })
  })
  assert.equal(denied.status, 403)
  const request = new Request('https://example.com/api/community/v1/appeal-decision', {
    method: 'POST', headers: { Authorization: token }, body: JSON.stringify({
      appealId, decision: 'upheld', reviewerNote: '复核确认，需作者重新投稿',
    }),
  })
  const allowed = await handleAppealDecision(request, async (url, options) => {
    const user = await auth(url)
    if (user) return user
    if (url.pathname === '/rest/v1/community_reviewers') return new Response(JSON.stringify([{ uid }]), { status: 200 })
    assert.equal(url.pathname, '/rest/v1/rpc/community_review_appeal')
    assert.equal(JSON.parse(options.body).p_decision, 'upheld')
    return new Response('"upheld"', { status: 200 })
  })
  assert.equal(allowed.status, 200)
})

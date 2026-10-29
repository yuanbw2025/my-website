import test from 'node:test'
import assert from 'node:assert/strict'
import { handleComments, handleCommentDecision, handleCommentReports, handleCommentReportDecision } from '../server/_lib/comments.js'

const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const commentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const token = `Bearer ${'a'.repeat(48)}`
function configured() {
  process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  process.env.COMMUNITY_SUPABASE_SECRET_KEY = 'sb_secret_test'
  process.env.COMMUNITY_ALLOWED_ORIGINS = 'https://example.com'
}

test('public comments are read through approved-only paged RPC', async () => {
  configured()
  const response = await handleComments(new Request('https://example.com/api/community/v1/comments?slug=good-work&offset=0'),
    async (url, options) => {
      assert.equal(url.pathname, '/rest/v1/rpc/community_read_comments')
      assert.equal(options.headers.apikey, 'sb_publishable_test')
      assert.equal(JSON.parse(options.body).p_limit, 50)
      return new Response(JSON.stringify([{ id: commentId, displayName: '读者', body: '好看', createdAt: '2026-10-29' }]), { status: 200 })
    })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).items[0].body, '好看')
})

test('comment filing authenticates and sends bounded metadata with an idempotency key', async () => {
  configured()
  const request = new Request('https://example.com/api/community/v1/comments', { method: 'POST',
    headers: { Authorization: token, Origin: 'https://example.com' },
    body: JSON.stringify({ slug: 'good-work', idempotencyKey: commentId, displayName: '读者', body: '好看' }) })
  const response = await handleComments(request, async (url, options) => {
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: uid }), { status: 200 })
    assert.equal(url.pathname, '/rest/v1/rpc/community_file_comment')
    assert.equal(options.headers.apikey, 'sb_secret_test')
    assert.equal(JSON.parse(options.body).p_body, '好看')
    return new Response(JSON.stringify(commentId), { status: 200 })
  })
  assert.equal(response.status, 201)
  assert.equal((await response.json()).status, 'pending')
})

test('review decision requires reviewer membership and cannot be made directly by a reader', async () => {
  configured()
  const request = () => new Request('https://example.com/api/community/v1/comment-decision', { method: 'POST',
    headers: { Authorization: token }, body: JSON.stringify({ commentId, decision: 'approve',
      reasonCode: 'reviewed_content', privateNote: '' }) })
  const notReviewer = await handleCommentDecision(request(), async url =>
    new Response(url.pathname === '/auth/v1/user' ? JSON.stringify({ id: uid }) : '[]', { status: 200 }))
  assert.equal(notReviewer.status, 403)
  const allowed = await handleCommentDecision(request(), async (url, options) => {
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: uid }), { status: 200 })
    if (url.pathname === '/rest/v1/community_reviewers') return new Response(JSON.stringify([{ uid }]), { status: 200 })
    assert.equal(url.pathname, '/rest/v1/rpc/community_review_comment')
    assert.equal(JSON.parse(options.body).p_decision, 'approve')
    return new Response('"approved"', { status: 200 })
  })
  assert.equal(allowed.status, 200)
})

test('comment report uses authenticated bounded metadata and reviewer-only decision', async () => {
  configured()
  const reportId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const filing = await handleCommentReports(new Request('https://example.com/api/community/v1/comment-reports', {
    method: 'POST', headers: { Authorization: token },
    body: JSON.stringify({ commentId, reasonCode: 'child_safety', details: '请复核' }),
  }), async (url, options) => {
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: uid }), { status: 200 })
    assert.equal(url.pathname, '/rest/v1/rpc/community_file_comment_report')
    assert.equal(JSON.parse(options.body).p_comment_id, commentId)
    return new Response(JSON.stringify(reportId), { status: 200 })
  })
  assert.equal(filing.status, 201)
  const review = await handleCommentReportDecision(new Request('https://example.com/api/community/v1/comment-report-decision', {
    method: 'POST', headers: { Authorization: token },
    body: JSON.stringify({ reportId, decision: 'take_down', reasonCode: 'confirmed_harm', privateNote: '' }),
  }), async (url, options) => {
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ id: uid }), { status: 200 })
    if (url.pathname === '/rest/v1/community_reviewers') return new Response(JSON.stringify([{ uid }]), { status: 200 })
    assert.equal(url.pathname, '/rest/v1/rpc/community_review_comment_report')
    assert.equal(JSON.parse(options.body).p_decision, 'take_down')
    return new Response('"actioned"', { status: 200 })
  })
  assert.equal(review.status, 200)
})

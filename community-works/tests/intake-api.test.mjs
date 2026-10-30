import test from 'node:test'
import assert from 'node:assert/strict'
import { createUploadSession } from '../server/_lib/intake.js'

const ownerId = '11111111-1111-4111-8111-111111111111'
const idempotencyKey = '22222222-2222-4222-8222-222222222222'
const uploadId = '33333333-3333-4333-8333-333333333333'
const manifest = { kind: 'novel', sha256: 'a'.repeat(64), byteLength: 1024, idempotencyKey }

function request(body = manifest, headers = {}) {
  return new Request('https://example.vercel.app/api/community/v1/upload-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${'x'.repeat(80)}`, ...headers },
    body: JSON.stringify(body),
  })
}

function setup() {
  process.env.COMMUNITY_ACCEPTING_SUBMISSIONS = '1'
  process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  process.env.COMMUNITY_SUPABASE_SECRET_KEY = 'sb_secret_test'
  process.env.COMMUNITY_R2_ACCOUNT_ID = 'a'.repeat(32)
  process.env.COMMUNITY_R2_BUCKET = 'storyforge-intake'
  process.env.COMMUNITY_R2_ACCESS_KEY_ID = 'test-access-key'
  process.env.COMMUNITY_R2_SECRET_ACCESS_KEY = 'test-secret-key'
}

test('intake stays closed without server-only configuration', async () => {
  setup()
  const previous = process.env.COMMUNITY_SUPABASE_SECRET_KEY
  delete process.env.COMMUNITY_SUPABASE_SECRET_KEY
  assert.equal((await createUploadSession(request())).status, 503)
  if (previous !== undefined) process.env.COMMUNITY_SUPABASE_SECRET_KEY = previous
  const r2Secret = process.env.COMMUNITY_R2_SECRET_ACCESS_KEY
  delete process.env.COMMUNITY_R2_SECRET_ACCESS_KEY
  assert.equal((await createUploadSession(request())).status, 503)
  if (r2Secret !== undefined) process.env.COMMUNITY_R2_SECRET_ACCESS_KEY = r2Secret
})

test('intake remains paused until the operator explicitly opens it', async () => {
  setup()
  delete process.env.COMMUNITY_ACCEPTING_SUBMISSIONS
  const result = await createUploadSession(request(), async () => { throw new Error('should not contact backend') })
  assert.equal(result.status, 503)
  assert.equal((await result.json()).error, 'intake_paused')
})

test('intake refuses unauthenticated and invalid metadata before allocating storage', async () => {
  setup()
  const noAuth = new Request('https://example.vercel.app/api/community/v1/upload-sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manifest),
  })
  assert.equal((await createUploadSession(noAuth)).status, 401)
  const invalid = await createUploadSession(request({ ...manifest, byteLength: 32 * 1024 * 1024 + 1 }), async url => {
    if (url.pathname === '/auth/v1/user') return Response.json({ id: ownerId })
    throw new Error('storage must not be allocated')
  })
  assert.equal(invalid.status, 400)
  const oversized = await createUploadSession(request({ ...manifest, padding: 'x'.repeat(5000) }), async url => {
    if (url.pathname === '/auth/v1/user') return Response.json({ id: ownerId })
    throw new Error('oversized control body must not reach storage')
  })
  assert.equal(oversized.status, 413)
})

test('one authenticated manifest gets a private signed target without manuscript bytes through Vercel', async () => {
  setup()
  let inserted
  const result = await createUploadSession(request(), async (url, options) => {
    if (url.pathname === '/auth/v1/user') {
      assert.equal(options.headers.apikey, 'sb_publishable_test')
      return Response.json({ id: ownerId })
    }
    assert.equal(options.headers.apikey, 'sb_secret_test')
    if (url.pathname === '/rest/v1/rpc/community_allocate_upload_session' && options.method === 'POST') {
      inserted = JSON.parse(options.body)
      return Response.json({ id: uploadId, owner_uid: ownerId, kind: manifest.kind,
        object_path: `${ownerId}/${uploadId}/snapshot.json`, sha256: manifest.sha256,
        byte_length: manifest.byteLength, status: 'created', expires_at: new Date(Date.now() + 3600000).toISOString() })
    }
    throw new Error(`unexpected request ${url}`)
  })
  assert.equal(result.status, 201)
  const data = await result.json()
  assert.equal(inserted.p_owner_uid, ownerId)
  assert.equal(inserted.p_idempotency_key, idempotencyKey)
  assert.equal(inserted.p_sha256, manifest.sha256)
  assert.equal(data.sha256, manifest.sha256)
  assert.equal(data.byteLength, manifest.byteLength)
  assert.equal(data.signedUrl.startsWith(`https://${'a'.repeat(32)}.r2.cloudflarestorage.com/storyforge-intake/${ownerId}/${uploadId}/snapshot.json?`), true)
  assert.equal(new URL(data.signedUrl).searchParams.get('X-Amz-SignedHeaders'), 'content-type;host')
  assert.equal(new URL(data.signedUrl).searchParams.get('X-Amz-Expires'), '900')
  assert.equal(data.uploadMethod, 'PUT')
  assert.equal(data.contentType, 'application/json')
  assert.equal(JSON.stringify(data).includes('sb_secret_test'), false)
})

test('R2 target is never signed for an object path different from the database allocation', async () => {
  setup()
  const result = await createUploadSession(request(), async url => {
    if (url.pathname === '/auth/v1/user') return Response.json({ id: ownerId })
    if (url.pathname === '/rest/v1/rpc/community_allocate_upload_session') {
      return Response.json({ id: uploadId, owner_uid: ownerId, kind: manifest.kind,
        object_path: `${ownerId}/${uploadId}/other.json`, sha256: manifest.sha256,
        byte_length: manifest.byteLength, status: 'created', expires_at: new Date(Date.now() + 3600000).toISOString() })
    }
    throw new Error(`unexpected request ${url}`)
  })
  assert.equal(result.status, 503)
  assert.equal((await result.json()).error, 'intake_unavailable')
})

test('same idempotency key cannot point to different content', async () => {
  setup()
  const result = await createUploadSession(request(), async url => {
    if (url.pathname === '/auth/v1/user') return Response.json({ id: ownerId })
    return Response.json({ error: 'idempotency_conflict' })
  })
  assert.equal(result.status, 409)
  assert.equal((await result.json()).error, 'idempotency_conflict')
})

test('server honors the atomic per-user daily allocation bound', async () => {
  setup()
  const result = await createUploadSession(request(), async url => {
    if (url.pathname === '/auth/v1/user') return Response.json({ id: ownerId })
    assert.equal(url.pathname, '/rest/v1/rpc/community_allocate_upload_session')
    return Response.json({ error: 'daily_upload_limit' })
  })
  assert.equal(result.status, 429)
  assert.equal((await result.json()).error, 'daily_upload_limit')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { createUploadSession } from '../../api/community/_lib/intake.js'

const ownerId = '11111111-1111-4111-8111-111111111111'
const idempotencyKey = '22222222-2222-4222-8222-222222222222'
const manifest = { kind: 'novel', sha256: 'a'.repeat(64), byteLength: 1024, idempotencyKey }

function request(body = manifest, headers = {}) {
  return new Request('https://example.vercel.app/api/community/v1/upload-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${'x'.repeat(80)}`, ...headers },
    body: JSON.stringify(body),
  })
}

function setup() {
  process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  process.env.COMMUNITY_SUPABASE_SECRET_KEY = 'sb_secret_test'
}

test('intake stays closed without server-only configuration', async () => {
  const previous = process.env.COMMUNITY_SUPABASE_SECRET_KEY
  delete process.env.COMMUNITY_SUPABASE_SECRET_KEY
  assert.equal((await createUploadSession(request())).status, 503)
  if (previous !== undefined) process.env.COMMUNITY_SUPABASE_SECRET_KEY = previous
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
    if (url.pathname === '/rest/v1/community_upload_sessions' && options.method === 'POST') {
      inserted = JSON.parse(options.body)
      return Response.json([{ ...inserted, status: 'created' }])
    }
    if (url.pathname === '/rest/v1/community_upload_sessions') return Response.json([])
    if (url.pathname.startsWith('/storage/v1/object/upload/sign/community-intake/')) {
      assert.equal(options.body, '{}')
      return Response.json({ url: `${url.pathname}?token=signed-token` })
    }
    throw new Error(`unexpected request ${url}`)
  })
  assert.equal(result.status, 201)
  const data = await result.json()
  assert.equal(inserted.owner_uid, ownerId)
  assert.equal(inserted.object_path.startsWith(`${ownerId}/`), true)
  assert.equal(data.sha256, manifest.sha256)
  assert.equal(data.byteLength, manifest.byteLength)
  assert.equal(data.signedUrl.startsWith('https://example.supabase.co/storage/v1/object/upload/sign/community-intake/'), true)
  assert.equal(JSON.stringify(data).includes('sb_secret_test'), false)
})

test('same idempotency key cannot point to different content', async () => {
  setup()
  const result = await createUploadSession(request(), async url => {
    if (url.pathname === '/auth/v1/user') return Response.json({ id: ownerId })
    return Response.json([{ kind: 'novel', sha256: 'b'.repeat(64), byte_length: 1024 }])
  })
  assert.equal(result.status, 409)
  assert.equal((await result.json()).error, 'idempotency_conflict')
})

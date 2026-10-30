import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanupExpiredIntake } from '../server/_lib/cleanup.js'

const owner = '11111111-1111-4111-8111-111111111111'
const session = '22222222-2222-4222-8222-222222222222'
const objectPath = `${owner}/${session}/snapshot.json`

function setup() {
  process.env.CRON_SECRET = 'private-cron-secret-123456'
  process.env.COMMUNITY_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COMMUNITY_SUPABASE_SECRET_KEY = 'sb_secret_test'
  process.env.COMMUNITY_R2_ACCOUNT_ID = 'a'.repeat(32)
  process.env.COMMUNITY_R2_BUCKET = 'storyforge-intake'
  process.env.COMMUNITY_R2_ACCESS_KEY_ID = 'test-access-key'
  process.env.COMMUNITY_R2_SECRET_ACCESS_KEY = 'test-secret-key'
}

function request(token = 'private-cron-secret-123456') {
  return new Request('https://example.vercel.app/api/community/v1/cleanup', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

test('orphan cleanup is inaccessible without the scheduled-job secret', async () => {
  setup()
  const result = await cleanupExpiredIntake(request('wrong'), {
    fetcher: () => { throw new Error('must not query database') },
  })
  assert.equal(result.status, 401)
})

test('orphan cleanup skips an object bound to a real submission', async () => {
  setup()
  let deleteCount = 0
  const result = await cleanupExpiredIntake(request(), {
    r2: { origin: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`,
      bucket: 'storyforge-intake', client: { fetch: () => { deleteCount++; throw new Error('must not delete') } } },
    fetcher: async url => {
      if (url.pathname.endsWith('community_upload_sessions')) {
        assert.equal(url.searchParams.get('purged_at'), 'is.null')
        return Response.json([{ id: session, owner_uid: owner, object_path: objectPath }])
      }
      if (url.pathname.endsWith('community_submissions')) return Response.json([{ id: '33333333-3333-4333-8333-333333333333' }])
      if (url.pathname.endsWith('community_publication_copies')) return Response.json([])
      throw new Error('unexpected query')
    },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { scanned: 1, purged: 0, copiesScanned: 0, copiesPurged: 0 })
  assert.equal(deleteCount, 0)
})

test('orphan cleanup deletes only its exact R2 key and records a purge receipt', async () => {
  setup()
  const calls = []
  const result = await cleanupExpiredIntake(request(), {
    r2: { origin: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`,
      bucket: 'storyforge-intake', client: { fetch: async (url, options) => {
        calls.push(['r2', url.pathname, options.method])
        return new Response(null, { status: 204 })
      } } },
    fetcher: async (url, options) => {
      if (url.pathname.endsWith('community_upload_sessions') && options.method !== 'PATCH') {
        calls.push(['sessions'])
        return Response.json([{ id: session, owner_uid: owner, object_path: objectPath }])
      }
      if (url.pathname.endsWith('community_submissions')) {
        calls.push(['submissions'])
        return Response.json([])
      }
      if (url.pathname.endsWith('community_upload_sessions') && options.method === 'PATCH') {
        calls.push(['receipt', JSON.parse(options.body).status])
        return Response.json([{ id: session }])
      }
      if (url.pathname.endsWith('community_publication_copies')) return Response.json([])
      throw new Error('unexpected query')
    },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { scanned: 1, purged: 1, copiesScanned: 0, copiesPurged: 0 })
  assert.deepEqual(calls, [['sessions'], ['submissions'],
    ['r2', `/storyforge-intake/${objectPath}`, 'DELETE'], ['receipt', 'expired']])
})

test('failed publication copies are purged; a committed publication retains its object', async () => {
  setup()
  const sha = 'a'.repeat(64)
  const orphan = `published/${session}/${sha}/snapshot.json`
  const live = `published/33333333-3333-4333-8333-333333333333/${sha}/snapshot.json`
  const deleted = []
  const result = await cleanupExpiredIntake(request(), {
    r2: { origin: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`,
      bucket: 'storyforge-intake', client: { fetch: async (url, options) => {
        assert.equal(options.method, 'DELETE')
        deleted.push(url.pathname)
        return new Response(null, { status: 204 })
      } } },
    fetcher: async (url, options) => {
      if (url.pathname.endsWith('community_upload_sessions')) return Response.json([])
      if (url.pathname.endsWith('community_publication_copies') && options.method !== 'PATCH') {
        return Response.json([{ object_path: live, submission_id: '33333333-3333-4333-8333-333333333333', sha256: sha },
          { object_path: orphan, submission_id: session, sha256: sha }])
      }
      if (url.pathname.endsWith('community_publications')) {
        return Response.json(url.searchParams.get('object_path') === `eq.${live}` ? [{ id: session }] : [])
      }
      if (url.pathname.endsWith('community_publication_copies') && options.method === 'PATCH') {
        assert.equal(JSON.parse(options.body).status, 'purged')
        return Response.json([{ object_path: orphan }])
      }
      throw new Error('unexpected query')
    },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { scanned: 0, purged: 0, copiesScanned: 2, copiesPurged: 1 })
  assert.deepEqual(deleted, [`/storyforge-intake/${orphan}`])
})

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

test('orphan cleanup retains every object bound to a real submission', async () => {
  setup()
  const result = await cleanupExpiredIntake(request(), {
    fetcher: async url => {
      if (url.pathname.endsWith('community_upload_sessions')) {
        assert.equal(url.searchParams.get('purged_at'), 'is.null')
        return Response.json([{ id: session, owner_uid: owner, object_path: objectPath }])
      }
      if (url.pathname.endsWith('community_submissions')) return Response.json([{ id: '33333333-3333-4333-8333-333333333333' }])
      throw new Error('must not delete submitted object')
    },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { scanned: 1, purged: 0 })
})

test('orphan cleanup deletes only its exact private Storage path and records a receipt', async () => {
  setup()
  const calls = []
  const result = await cleanupExpiredIntake(request(), {
    fetcher: async (url, options) => {
      if (url.pathname.endsWith('community_upload_sessions') && options.method !== 'PATCH') {
        calls.push('sessions')
        return Response.json([{ id: session, owner_uid: owner, object_path: objectPath }])
      }
      if (url.pathname.endsWith('community_submissions')) {
        calls.push('submissions')
        return Response.json([])
      }
      if (url.pathname === '/storage/v1/object/community-intake') {
        assert.equal(options.method, 'DELETE')
        assert.equal(options.headers.apikey, 'sb_secret_test')
        assert.deepEqual(JSON.parse(options.body), { prefixes: [objectPath] })
        calls.push('storage')
        return Response.json([{ name: objectPath }])
      }
      if (url.pathname.endsWith('community_upload_sessions') && options.method === 'PATCH') {
        assert.equal(JSON.parse(options.body).status, 'expired')
        calls.push('receipt')
        return Response.json([{ id: session }])
      }
      throw new Error('unexpected request')
    },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { scanned: 1, purged: 1 })
  assert.deepEqual(calls, ['sessions', 'submissions', 'storage', 'receipt'])
})

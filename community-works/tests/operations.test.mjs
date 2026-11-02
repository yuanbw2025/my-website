import test from 'node:test'
import assert from 'node:assert/strict'
import { database, owner, reviewer, reporter, upload, slug, transition } from './database-fixture.mjs'
import operations from '../server/v1/operations.js'
import { reviewerToken } from './reviewer-token.mjs'

const snapshot = async db => (await db.query('select community_operations_snapshot($1::uuid) as value', [reviewer])).rows[0].value

test('operations returns read-only aggregate metrics, including unsubmitted expired cleanup candidates', async () => {
  const db = await database()
  try {
    await db.query(`insert into community_upload_sessions
      (owner_uid,idempotency_key,kind,object_path,sha256,byte_length,created_at,expires_at)
      values ($1::uuid,gen_random_uuid(),'novel',$1::text||'/'||gen_random_uuid()::text||'/snapshot.json',repeat('a',64),1,now()-interval '3 days',now()-interval '2 days')`, [owner])
    await db.query("update community_upload_sessions set created_at=now()-interval '3 days' where id=$1", [upload])
    const result = await snapshot(db)
    assert.equal(result.storage.reservedBytes, 2 * 33554432)
    assert.equal(result.storage.cleanupEligibleSessions, 1) // Submitted original never a purge candidate.
    assert.equal(result.storage.pendingSessions, 2)
    assert.equal(result.queues.submissions, 1)
    assert.equal(result.queues.comments, 0)
    assert(result.queues.oldestPendingAt)
    const json = JSON.stringify(result)
    for (const privateValue of [owner, reviewer, 'snapshot.json', '笔名', 'repeat']) assert(!json.includes(privateValue))
    assert.equal((await db.query('select count(*)::integer as n from community_upload_sessions')).rows[0].n, 2)
  } finally { await db.close() }
})

test('resolved reports leave the urgent count and stalled model work remains visible without retrying', async () => {
  const db = await database()
  try {
    for (const action of ['begin_review', 'approve', 'publish']) await transition(db, action, action === 'publish' ? {
      kind: 'novel', title: 'Synthetic', description: '', language: 'zh-CN', toc: { chapters: [{ title: 'One' }] },
    } : null)
    const report = (await db.query("select community_file_report($1,$2,'child_safety','Synthetic test only') as id", [reporter, slug])).rows[0].id
    assert.equal((await snapshot(db)).queues.urgentReports, 1)
    await db.query("select community_review_report($1,$2,'dismiss','synthetic_test','')", [reviewer, report])
    assert.equal((await snapshot(db)).queues.urgentReports, 0)
    await db.query("update community_automod_jobs set state='processing',lease_until=now()-interval '1 minute'")
    assert.equal((await snapshot(db)).queues.expiredModelLeases, 1)
    assert.equal((await db.query('select count(*)::integer as n from community_automod_attempts')).rows[0].n, 0)
  } finally { await db.close() }
})

test('capacity display and allocator share fail-closed observations; unknown is never shown as zero', async () => {
  const db = await database()
  try {
    await db.query("insert into storage.objects(bucket_id,name,metadata) values ('community-intake','orphan',null)")
    let result = await snapshot(db)
    assert.equal(result.storage.unknownSizeObjects, 1)
    assert.equal(result.storage.observedBytes, null)
    assert.equal(result.storage.reservedBytes, null)
    assert.equal(result.storage.canAllocate, false)
    await db.query(`update storage.objects set metadata='{"size":1234}'`)
    result = await snapshot(db)
    assert.equal(result.storage.unboundObjects, 1)
    assert.equal(result.storage.observedBytes, 1234)
    assert.equal(result.storage.reservedBytes, 33554432 + 1234)
    assert.equal(result.storage.canAllocate, true)
    await db.query("update storage.buckets set public=true where id='community-intake'")
    result = await snapshot(db)
    assert.equal(result.storage.bucketSafe, false)
    assert.equal(result.storage.canAllocate, false)
  } finally { await db.close() }
})

test('aggregate RPC denies ordinary/revoked actors and cannot be called by client roles', async () => {
  const db = await database()
  try {
    await assert.rejects(db.query('select community_operations_snapshot($1::uuid)', [owner]), /reviewer_required/)
    await db.query('update community_reviewers set active=false where uid=$1', [reviewer])
    await assert.rejects(snapshot(db), /reviewer_required/)
    for (const role of ['anon', 'authenticated']) {
      const result = await db.query(`select has_function_privilege($1,'community_operations_snapshot(uuid)','execute') as ops,
        has_function_privilege($1,'community_storage_capacity_snapshot()','execute') as storage`, [role])
      assert.deepEqual(result.rows[0], { ops: false, storage: false })
    }
  } finally { await db.close() }
})

test('operations API rechecks Auth, membership, AAL2 and refuses private or malformed upstream fields', async () => {
  const db = await database()
  process.env.COMMUNITY_SUPABASE_URL = 'https://fixture.supabase.co'
  process.env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY = 'public-fixture'
  process.env.COMMUNITY_SUPABASE_SECRET_KEY = 'private-fixture'
  const url = 'https://site.example/api/community/v1/operations'
  let reads = 0, member = true, authValid = true
  let body = await snapshot(db)
  const fetcher = async (raw, options) => {
    const path = new URL(raw).pathname
    if (path === '/auth/v1/user') return Response.json({ id: reviewer }, { status: authValid ? 200 : 401 })
    if (path === '/rest/v1/community_reviewers') return Response.json(member ? [{ uid: reviewer }] : [])
    assert.equal(path, '/rest/v1/rpc/community_operations_snapshot')
    assert.deepEqual(JSON.parse(options.body), { p_actor: reviewer })
    reads++
    return Response.json(body)
  }
  const request = token => new Request(url, { headers: token ? { Authorization: token } : {} })
  try {
    assert.equal((await operations.fetch(request(), fetcher)).status, 401)
    assert.equal((await operations.fetch(request(reviewerToken(reviewer, 'aal1')), fetcher)).status, 403)
    assert.equal((await operations.fetch(request(reviewerToken(reviewer, 'aal2', 1)), fetcher)).status, 403)
    member = false
    assert.equal((await operations.fetch(request(reviewerToken(reviewer)), fetcher)).status, 403)
    member = true; authValid = false
    assert.equal((await operations.fetch(request(reviewerToken(reviewer)), fetcher)).status, 401)
    assert.equal(reads, 0)
    authValid = true
    const result = await operations.fetch(request(reviewerToken(reviewer)), fetcher)
    assert.equal(result.status, 200)
    assert.match(result.headers.get('cache-control'), /no-store/)
    assert.equal((await result.json()).gateway.acceptingSubmissions, false)
    body = { ...body, email: 'never-return@example.invalid' }
    const rejected = await operations.fetch(request(reviewerToken(reviewer)), fetcher)
    assert.equal(rejected.status, 503)
    assert(!JSON.stringify(await rejected.json()).includes('never-return'))
    body = await snapshot(db); body.storage.reservedBytes = null
    assert.equal((await operations.fetch(request(reviewerToken(reviewer)), fetcher)).status, 503)
    assert.equal((await operations.fetch(new Request(url, { method: 'POST' }), fetcher)).status, 405)
    assert.equal((await operations.fetch(new Request(url, { headers: { Origin: 'https://hostile.invalid' } }), fetcher)).status, 403)
  } finally { await db.close() }
})

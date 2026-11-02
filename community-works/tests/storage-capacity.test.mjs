import test from 'node:test'
import assert from 'node:assert/strict'
import { database, owner, upload, hash } from './database-fixture.mjs'

const MAX = 33554432
const key = '00000000-0000-4000-8000-000000000999'
const allocate = async (db, idempotency = key) => (await db.query(`
  select public.community_allocate_upload_session($1::uuid, $2::uuid, 'novel', $3, 100) as result`,
  [owner, idempotency, hash])).rows[0].result

async function sessions(db, count, status = 'expired', actualSize = null) {
  const rows = (await db.query(`insert into public.community_upload_sessions
    (owner_uid, idempotency_key, kind, object_path, sha256, byte_length, status, created_at, expires_at)
    select $1::uuid, gen_random_uuid(), 'novel',
      $1::text || '/' || gen_random_uuid()::text || '/snapshot.json',
      $2, 1, $3, now() - interval '3 days', now() - interval '2 days'
    from generate_series(1, $4::integer) returning object_path`, [owner, hash, status, count])).rows
  if (actualSize !== null) {
    for (const row of rows) await db.query(`insert into storage.objects(bucket_id, name, metadata)
      values ('community-intake', $1, jsonb_build_object('size', $2::bigint))`, [row.object_path, actualSize])
  }
  return rows
}

test('tiny declarations cannot allocate more signed upload capacity than the global ceiling', async () => {
  const db = await database()
  try {
    await sessions(db, 22) // Together with the original session: 736 MiB reserved.
    assert.equal((await allocate(db)).error, 'storage_capacity_paused')
    assert.equal((await allocate(db, upload)).id, upload) // Resume uses its existing reservation.
    assert.equal((await db.query('select count(*)::integer as n from community_upload_sessions')).rows[0].n, 23)
    await sessions(db, 1) // A legacy over-allocation must not issue another signed target.
    assert.equal((await allocate(db, upload)).error, 'storage_capacity_paused')
  } finally { await db.close() }
})

test('verified immutable objects release excess reservation without being counted twice', async () => {
  const db = await database()
  try {
    await db.query("update community_upload_sessions set status = 'verified' where id = $1", [upload])
    await db.query(`insert into storage.objects(bucket_id, name, metadata)
      values ('community-intake', $1, '{"size":100}')`, [`${owner}/${upload}/snapshot.json`])
    // Double-counting these objects would exceed 750 MiB on the next allocation.
    await sessions(db, 22, 'verified', 17 * 1024 * 1024)
    assert.equal((await allocate(db)).byte_length, 100)
  } finally { await db.close() }
})

test('verified objects are charged their observed size even if a legacy declaration is smaller', async () => {
  const db = await database()
  try {
    await sessions(db, 22, 'verified', MAX)
    assert.equal((await allocate(db)).error, 'storage_capacity_paused')
  } finally { await db.close() }
})

test('a verified row with a missing object keeps its full reservation', async () => {
  const db = await database()
  try {
    await sessions(db, 22, 'verified')
    assert.equal((await allocate(db)).error, 'storage_capacity_paused')
  } finally { await db.close() }
})

test('unbound objects and objects remaining after a purge receipt still consume capacity', async () => {
  const db = await database()
  try {
    await sessions(db, 21, 'verified', MAX)
    const [purged] = await sessions(db, 1, 'expired', MAX)
    await db.query('update community_upload_sessions set purged_at = now() where object_path = $1', [purged.object_path])
    await db.query(`insert into storage.objects(bucket_id, name, metadata)
      values ('community-intake', 'orphan/snapshot.json', jsonb_build_object('size', $1::integer))`, [MAX])
    assert.equal((await allocate(db)).error, 'storage_capacity_paused')
    // This is fixture-only metadata removal. Production cleanup must use Storage's API.
    await db.query('delete from storage.objects where name = $1', [purged.object_path])
    assert.equal((await allocate(db)).error, 'storage_capacity_paused')
    await db.query("delete from storage.objects where name = 'orphan/snapshot.json'")
    assert.equal((await allocate(db)).byte_length, 100)
  } finally { await db.close() }
})

test('unknown object sizes and unsafe bucket settings fail closed, including signed-target renewal', async () => {
  const db = await database()
  try {
    for (const metadata of [null, {}, { size: -1 }, { size: 'garbage' }, { size: '1e100' }, { size: 0.5 }]) {
      await db.query(`insert into storage.objects(bucket_id, name, metadata)
        values ('community-intake', 'unknown/snapshot.json', $1::jsonb)
        on conflict (bucket_id, name) do update set metadata = excluded.metadata`, [JSON.stringify(metadata)])
      assert.equal((await allocate(db)).error, 'storage_capacity_paused')
      assert.equal((await allocate(db, upload)).error, 'storage_capacity_paused')
    }
    await db.query("delete from storage.objects where name = 'unknown/snapshot.json'")
    for (const settings of ['public = true', 'public = null', 'file_size_limit = null', 'file_size_limit = 67108864']) {
      await db.exec(`update storage.buckets set public = false, file_size_limit = ${MAX};
        update storage.buckets set ${settings} where id = 'community-intake'`)
      assert.equal((await allocate(db, upload)).error, 'storage_capacity_paused')
    }
  } finally { await db.close() }
})

test('a purged session cannot renew a signed target even if its status is stale', async () => {
  const db = await database()
  try {
    await db.query('update community_upload_sessions set purged_at = now() where id = $1', [upload])
    assert.equal((await allocate(db, upload)).error, 'upload_session_expired_or_used')
  } finally { await db.close() }
})

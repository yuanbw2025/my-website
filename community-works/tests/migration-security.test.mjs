import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const migrationDirectory = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const reviewer = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const reporter = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const submission = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const upload = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const hash = 'a'.repeat(64)
const slug = `work-${submission.replaceAll('-', '')}`

async function database() {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key);
    create table storage.buckets(id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public to anon, authenticated, service_role;
  `)
  for (const name of readdirSync(migrationDirectory).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'))
  }
  await db.query('insert into auth.users(id) values ($1), ($2), ($3)', [owner, reviewer, reporter])
  await db.query(`insert into public.community_reviewers(uid, role, active)
    values ($1, 'reviewer', true)`, [reviewer])
  await db.query(`insert into public.community_upload_sessions
    (id, owner_uid, idempotency_key, kind, object_path, sha256, byte_length, expires_at)
    values ($1, $2, $3, 'novel', $4, $5, 100, now() + interval '1 hour')`,
    [upload, owner, upload, `${owner}/${upload}/${submission}/snapshot.json`, hash])
  await db.query(`insert into public.community_submissions
    (id, owner_uid, upload_session_id, kind, object_path, sha256, byte_length,
     public_pen_name, license, rights_statement_version)
    values ($1, $2, $3, 'novel', $4, $5, 100, '笔名', 'all-rights-reserved', 1)`,
    [submission, owner, upload, `${owner}/${upload}/${submission}/snapshot.json`, hash])
  return db
}

async function transition(db, action, publication = null, actor = reviewer, revision = hash) {
  return db.query(`select public.community_review_transition(
    $1::uuid, $2::uuid, $3::text, $4::text, 'reviewed_content', '', $5::jsonb) as status`,
  [actor, submission, revision, action, publication && JSON.stringify(publication)])
}

test('migrations enforce revision-bound review, bounded public reading, and atomic takedown', async () => {
  const db = await database()
  try {
    await assert.rejects(transition(db, 'approve'), /invalid_moderation_transition/)
    await db.query(`insert into public.community_reviewers(uid, role, active)
      values ($1, 'reviewer', true)`, [owner])
    await assert.rejects(transition(db, 'begin_review', null, owner), /self_review_forbidden/)
    await assert.rejects(transition(db, 'begin_review', null, reviewer, 'b'.repeat(64)), /revision_mismatch/)
    assert.equal((await transition(db, 'begin_review')).rows[0].status, 'human_review')
    assert.equal((await transition(db, 'approve')).rows[0].status, 'approved')

    const content = '甲'.repeat(250001)
    const publication = { kind: 'novel', title: '公开小说', description: '简介', language: 'zh-CN',
      body: { chapters: [{ title: '第一章', content }] },
      toc: { chapters: [{ title: '第一章' }] },
    }
    assert.equal((await transition(db, 'publish', publication)).rows[0].status, 'published')
    await db.exec('set role anon')
    assert.equal((await db.query('select count(*)::integer as total from public.community_publications')).rows[0].total, 1)
    const first = (await db.query('select public.community_read_part($1, 0, 0, 0) as part', [slug])).rows[0].part
    assert.equal(first.text.length, 250000)
    assert.equal(first.hasMore, true)
    const final = (await db.query('select public.community_read_part($1, 0, 0, 1) as part', [slug])).rows[0].part
    assert.equal(final.text, '甲')
    assert.equal(final.hasMore, false)
    const toc = (await db.query('select public.community_read_toc_page($1, -1, 0, 100) as page', [slug])).rows[0].page
    assert.equal(toc.items[0].title, '第一章')
    await assert.rejects(db.query(`select public.community_review_transition(
      $1::uuid, $2::uuid, $3::text, 'take_down', 'confirmed_harm')`,
      [reviewer, submission, hash]), /permission denied/)
    await db.exec('reset role')
    assert.equal((await transition(db, 'take_down')).rows[0].status, 'taken_down')
    await db.exec('set role anon')
    assert.equal((await db.query('select count(*)::integer as total from public.community_publications')).rows[0].total, 0)
    assert.equal((await db.query('select public.community_read_part($1, 0, 0, 0) as part', [slug])).rows[0].part, null)
    assert.equal((await db.query('select public.community_read_toc_page($1, -1, 0, 100) as page', [slug])).rows[0].page, null)
  } finally { await db.close() }
})

test('a report is private, deduplicated, and its review can atomically remove a published work', async () => {
  const db = await database()
  try {
    await transition(db, 'begin_review')
    await transition(db, 'approve')
    await transition(db, 'publish', { kind: 'novel', title: '公开小说', description: '', language: 'zh-CN',
      body: { chapters: [{ title: '第一章', content: '内容' }] },
      toc: { chapters: [{ title: '第一章' }] } })
    const filed = await db.query(`select public.community_file_report($1::uuid, $2, 'child_safety', '请复核') as id`,
      [reporter, slug])
    const reportId = filed.rows[0].id
    assert.equal((await db.query(`select public.community_file_report($1::uuid, $2, 'child_safety', '重复') as id`,
      [reporter, slug])).rows[0].id, reportId)
    await db.exec('set role anon')
    await assert.rejects(db.query('select * from public.community_reports'), /permission denied/)
    await db.exec('reset role')
    await assert.rejects(db.query(`select public.community_review_report(
      $1::uuid, $2::uuid, 'take_down', 'confirmed_harm')`,
      [reporter, reportId]), /reviewer_required/)
    assert.equal((await db.query(`select public.community_review_report(
      $1::uuid, $2::uuid, 'take_down', 'confirmed_harm') as status`,
      [reviewer, reportId])).rows[0].status, 'actioned')
    await db.exec('set role anon')
    assert.equal((await db.query('select count(*)::integer as total from public.community_publications')).rows[0].total, 0)
    await db.exec('reset role')
    assert.equal((await db.query('select status from public.community_submissions where id = $1', [submission])).rows[0].status, 'taken_down')
  } finally { await db.close() }
})

test('upload allocation enforces owner idempotency and the daily cap inside one database transaction', async () => {
  const db = await database()
  try {
    await db.exec('set role authenticated')
    await assert.rejects(db.query(`select public.community_allocate_upload_session(
      $1::uuid, $2::uuid, 'novel', $3, 100)`, [owner, upload, hash]), /permission denied/)
    await db.exec('reset role')
    const allocate = (key, digest = hash) => db.query(`select public.community_allocate_upload_session(
      $1::uuid, $2::uuid, 'novel', $3, 100) as result`, [owner, key, digest])
    const old = (await allocate(upload)).rows[0].result
    assert.equal(old.id, upload)
    assert.equal((await allocate(upload, 'b'.repeat(64))).rows[0].result.error, 'idempotency_conflict')
    for (let index = 1; index <= 9; index++) {
      const key = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
      const row = (await allocate(key)).rows[0].result
      assert.equal(row.owner_uid, owner)
      assert.equal(row.object_path, `${owner}/${row.id}/snapshot.json`)
    }
    const eleventh = (await allocate('00000000-0000-4000-8000-000000000010')).rows[0].result
    assert.equal(eleventh.error, 'daily_upload_limit')
    assert.equal((await db.query('select count(*)::integer as total from public.community_upload_sessions')).rows[0].total, 10)
  } finally { await db.close() }
})

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

async function database({ existingPublicBucket = false } = {}) {
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
  if (existingPublicBucket) {
    await db.query(`insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
      values ('community-intake', 'community-intake', true, 100000000,
        array['text/plain'])`)
  }
  for (const name of readdirSync(migrationDirectory).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'))
  }
  await db.query('insert into auth.users(id) values ($1), ($2), ($3)', [owner, reviewer, reporter])
  await db.query(`insert into public.community_reviewers(uid, role, active)
    values ($1, 'reviewer', true)`, [reviewer])
  await db.query(`insert into public.community_upload_sessions
    (id, owner_uid, idempotency_key, kind, object_path, sha256, byte_length, expires_at)
    values ($1, $2, $3, 'novel', $4, $5, 100, now() + interval '1 hour')`,
    [upload, owner, upload, `${owner}/${upload}/snapshot.json`, hash])
  await db.query(`insert into public.community_submissions
    (id, owner_uid, upload_session_id, kind, object_path, sha256, byte_length,
     public_pen_name, license, rights_statement_version)
    values ($1, $2, $3, 'novel', $4, $5, 100, '笔名', 'all-rights-reserved', 1)`,
    [submission, owner, upload, `${owner}/${upload}/snapshot.json`, hash])
  return db
}

test('migration creates a private Storage bucket and locks down an older public bucket', async () => {
  const db = await database({ existingPublicBucket: true })
  try {
    const { rows } = await db.query(`select public, file_size_limit, allowed_mime_types
      from storage.buckets where id = 'community-intake'`)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].public, false)
    assert.equal(Number(rows[0].file_size_limit), 33554432)
    assert.deepEqual(rows[0].allowed_mime_types,
      ['application/json', 'application/vnd.storyforge.community-snapshot+json'])
  } finally { await db.close() }
  const fresh = await database()
  try {
    const { rows } = await fresh.query(`select id from storage.buckets where id = 'community-intake'`)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 'community-intake')
  } finally { await fresh.close() }
})

test('orphan cleanup migration records purged objects without deleting submission history', async () => {
  const db = await database()
  try {
    const result = await db.query(`update public.community_upload_sessions
      set status = 'expired', purged_at = now() where id = $1 returning id, purged_at`, [upload])
    assert.equal(result.rows[0].id, upload)
    assert.ok(result.rows[0].purged_at)
    const submissions = await db.query('select id from public.community_submissions where upload_session_id = $1', [upload])
    assert.equal(submissions.rows[0].id, submission)
  } finally { await db.close() }
})

async function transition(db, action, publication = null, actor = reviewer, revision = hash) {
  const publicProjection = publication && {
    ...publication, objectPath: `${owner}/${upload}/snapshot.json`,
  }
  if (publicProjection) delete publicProjection.body
  return db.query(`select public.community_review_transition(
    $1::uuid, $2::uuid, $3::text, $4::text, 'reviewed_content', '', $5::jsonb) as status`,
  [actor, submission, revision, action, publicProjection && JSON.stringify(publicProjection)])
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
    await assert.rejects(db.query(`select public.community_review_transition(
      $1::uuid, $2::uuid, $3::text, 'publish', 'reviewed_content', '', $4::jsonb)`,
    [reviewer, submission, hash, JSON.stringify({ kind: 'novel', title: '伪造',
      description: '', language: 'zh-CN', toc: { chapters: [{ title: '第一章' }] },
      objectPath: `${owner}/${submission}/snapshot.json` })]), /invalid_publication/)

    const publication = { kind: 'novel', title: '公开小说', description: '简介', language: 'zh-CN',
      toc: { chapters: [{ title: '第一章' }] },
    }
    assert.equal((await transition(db, 'publish', publication)).rows[0].status, 'published')
    await db.exec('set role anon')
    assert.equal((await db.query('select count(*)::integer as total from public.community_publications')).rows[0].total, 1)
    const first = (await db.query('select public.community_read_part($1, 0, 0, 0) as part', [slug])).rows[0].part
    assert.deepEqual(first, { objectPath: `${owner}/${upload}/snapshot.json`, sha256: hash, kind: 'novel' })
    assert.equal((await db.query(`select count(*)::integer as total from information_schema.columns
      where table_schema = 'public' and table_name = 'community_publications' and column_name = 'body'`)).rows[0].total, 0)
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

test('storage reservation pauses intake before the free-tier ceiling and resumes after exact cleanup', async () => {
  const db = await database()
  try {
    await db.query(`insert into public.community_upload_sessions
      (owner_uid, idempotency_key, kind, object_path, sha256, byte_length,
       status, created_at, expires_at)
      select $1::uuid, gen_random_uuid(), 'novel',
        $1::text || '/' || gen_random_uuid()::text || '/snapshot.json',
        $2, 33554432, 'expired', now() - interval '2 days', now() - interval '1 day'
      from generate_series(1, 23)`, [owner, hash])
    const key = '00000000-0000-4000-8000-000000000030'
    const allocate = () => db.query(`select public.community_allocate_upload_session(
      $1::uuid, $2::uuid, 'novel', $3, 15728640) as result`, [owner, key, hash])
    assert.equal((await allocate()).rows[0].result.error, 'storage_capacity_paused')
    await db.query(`update public.community_upload_sessions set purged_at = now()
      where id = (select id from public.community_upload_sessions
        where status = 'expired' and purged_at is null limit 1)`)
    const resumed = (await allocate()).rows[0].result
    assert.equal(resumed.byte_length, 15728640)
    assert.equal(resumed.object_path, `${owner}/${resumed.id}/snapshot.json`)
  } finally { await db.close() }
})

test('comments stay private until independent approval and disappear when the work is taken down', async () => {
  const db = await database()
  try {
    await transition(db, 'begin_review')
    await transition(db, 'approve')
    await transition(db, 'publish', { kind: 'novel', title: '公开小说', description: '', language: 'zh-CN',
      body: { chapters: [{ title: '第一章', content: '内容' }] },
      toc: { chapters: [{ title: '第一章' }] } })
    const key = '00000000-0000-4000-8000-000000000020'
    const file = (content = '认真讨论作品') => db.query(`select public.community_file_comment(
      $1::uuid, $2, $3::uuid, '读者', $4) as id`, [reporter, slug, key, content])
    const id = (await file()).rows[0].id
    assert.equal((await file()).rows[0].id, id)
    await assert.rejects(file('另一条内容'), /idempotency_conflict/)
    await db.exec('set role anon')
    assert.deepEqual((await db.query('select public.community_read_comments($1, 0, 50) as items', [slug])).rows[0].items, [])
    await db.exec('reset role')
    await db.query(`insert into public.community_reviewers(uid, role, active)
      values ($1, 'reviewer', true)`, [reporter])
    await assert.rejects(db.query(`select public.community_review_comment(
      $1::uuid, $2::uuid, 'approve', 'reviewed')`, [reporter, id]), /self_review_forbidden/)
    assert.equal((await db.query(`select public.community_review_comment(
      $1::uuid, $2::uuid, 'approve', 'reviewed') as status`, [reviewer, id])).rows[0].status, 'approved')
    await db.exec('set role anon')
    const visible = (await db.query('select public.community_read_comments($1, 0, 50) as items', [slug])).rows[0].items
    assert.equal(visible.length, 1)
    assert.equal(visible[0].body, '认真讨论作品')
    await assert.rejects(db.query(`select public.community_file_comment(
      $1::uuid, $2, $3::uuid, '读者', '越权')`, [reporter, slug, key]), /permission denied/)
    await db.exec('reset role')
    await transition(db, 'take_down')
    await db.exec('set role anon')
    assert.deepEqual((await db.query('select public.community_read_comments($1, 0, 50) as items', [slug])).rows[0].items, [])
  } finally { await db.close() }
})

test('a reported comment can be removed only through an audited reviewer transaction', async () => {
  const db = await database()
  try {
    await transition(db, 'begin_review')
    await transition(db, 'approve')
    await transition(db, 'publish', { kind: 'novel', title: '公开小说', description: '', language: 'zh-CN',
      body: { chapters: [{ title: '第一章', content: '内容' }] },
      toc: { chapters: [{ title: '第一章' }] } })
    const comment = (await db.query(`select public.community_file_comment(
      $1::uuid, $2, $3::uuid, '读者', '一条待处理评论') as id`,
    [owner, slug, '00000000-0000-4000-8000-000000000021'])).rows[0].id
    await db.query(`select public.community_review_comment(
      $1::uuid, $2::uuid, 'approve', 'reviewed')`, [reviewer, comment])
    const report = (await db.query(`select public.community_file_comment_report(
      $1::uuid, $2::uuid, 'child_safety', '请复核') as id`, [reporter, comment])).rows[0].id
    assert.equal((await db.query(`select public.community_file_comment_report(
      $1::uuid, $2::uuid, 'child_safety', '重复') as id`, [reporter, comment])).rows[0].id, report)
    await db.exec('set role anon')
    await assert.rejects(db.query('select * from public.community_comment_reports'), /permission denied/)
    await db.exec('reset role')
    await db.query(`insert into public.community_reviewers(uid, role, active)
      values ($1, 'reviewer', true)`, [reporter])
    await assert.rejects(db.query(`select public.community_review_comment_report(
      $1::uuid, $2::uuid, 'take_down', 'confirmed_harm')`, [reporter, report]), /self_report_review_forbidden/)
    assert.equal((await db.query(`select public.community_review_comment_report(
      $1::uuid, $2::uuid, 'take_down', 'confirmed_harm') as status`,
    [reviewer, report])).rows[0].status, 'actioned')
    await db.exec('set role anon')
    assert.deepEqual((await db.query('select public.community_read_comments($1, 0, 50) as items', [slug])).rows[0].items, [])
    await db.exec('reset role')
    assert.equal((await db.query(`select count(*)::integer as total from public.community_comment_events
      where comment_id = $1 and decision = 'take_down'`, [comment])).rows[0].total, 1)
  } finally { await db.close() }
})

test('author withdrawal atomically hides a published work; appeal never republishes by itself', async () => {
  const db = await database()
  try {
    await transition(db, 'begin_review')
    await transition(db, 'approve')
    await transition(db, 'publish', { kind: 'novel', title: '公开小说', description: '', language: 'zh-CN',
      body: { chapters: [{ title: '第一章', content: '内容' }] },
      toc: { chapters: [{ title: '第一章' }] } })
    await assert.rejects(db.query(`select public.community_owner_withdraw(
      $1::uuid, $2::uuid, $3)`, [reporter, submission, hash]), /submission_not_found/)
    await assert.rejects(db.query(`select public.community_owner_withdraw(
      $1::uuid, $2::uuid, $3)`, [owner, submission, 'b'.repeat(64)]), /revision_mismatch/)
    assert.equal((await db.query(`select public.community_owner_withdraw(
      $1::uuid, $2::uuid, $3) as status`, [owner, submission, hash])).rows[0].status, 'withdrawn')
    await db.exec('set role anon')
    assert.equal((await db.query('select count(*)::integer as total from public.community_publications')).rows[0].total, 0)
    await db.exec('reset role')
    assert.equal((await db.query(`select count(*)::integer as total from public.community_owner_events
      where submission_id = $1`, [submission])).rows[0].total, 1)
    await assert.rejects(db.query(`select public.community_file_appeal(
      $1::uuid, $2::uuid, $3, '复核')`, [owner, submission, hash]), /appeal_not_allowed/)
  } finally { await db.close() }
})

test('appeal is private, revision-bound, and needs an independent reviewer decision', async () => {
  const db = await database()
  try {
    await transition(db, 'begin_review')
    await transition(db, 'reject')
    await assert.rejects(db.query(`select public.community_file_appeal(
      $1::uuid, $2::uuid, $3, '复核')`, [reporter, submission, hash]), /submission_not_found/)
    const appeal = (await db.query(`select public.community_file_appeal(
      $1::uuid, $2::uuid, $3, '请重新检查') as id`, [owner, submission, hash])).rows[0].id
    assert.equal((await db.query(`select public.community_file_appeal(
      $1::uuid, $2::uuid, $3, '重试') as id`, [owner, submission, hash])).rows[0].id, appeal)
    await db.exec('set role anon')
    await assert.rejects(db.query('select * from public.community_appeals'), /permission denied/)
    await db.exec('reset role')
    await db.query(`insert into public.community_reviewers(uid, role, active)
      values ($1, 'reviewer', true)`, [owner])
    await assert.rejects(db.query(`select public.community_review_appeal(
      $1::uuid, $2::uuid, 'upheld', '复核确认')`, [owner, appeal]), /self_review_forbidden/)
    assert.equal((await db.query(`select public.community_review_appeal(
      $1::uuid, $2::uuid, 'upheld', '复核确认') as status`, [reviewer, appeal])).rows[0].status, 'upheld')
    assert.equal((await db.query('select status from public.community_submissions where id = $1', [submission])).rows[0].status, 'rejected')
  } finally { await db.close() }
})

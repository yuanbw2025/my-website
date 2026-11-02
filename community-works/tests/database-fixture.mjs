import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const migrationDirectory = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
export const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const reviewer = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const reporter = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
export const submission = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
export const upload = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
export const hash = 'a'.repeat(64)
export const slug = `work-${submission.replaceAll('-', '')}`

export async function database({ existingPublicBucket = false, beforeSocial = false } = {}) {
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
  for (const name of readdirSync(migrationDirectory).filter(name => name.endsWith('.sql') && (!beforeSocial || name.startsWith('202610'))).sort()) {
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

export async function transition(db, action, publication = null, actor = reviewer, revision = hash) {
  const publicProjection = publication && {
    ...publication, objectPath: `${owner}/${upload}/snapshot.json`,
  }
  if (publicProjection) delete publicProjection.body
  return db.query(`select public.community_review_transition(
    $1::uuid, $2::uuid, $3::text, $4::text, 'reviewed_content', '', $5::jsonb) as status`,
  [actor, submission, revision, action, publicProjection && JSON.stringify(publicProjection)])
}

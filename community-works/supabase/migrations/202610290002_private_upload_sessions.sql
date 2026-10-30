-- Intake metadata is private. Existing prototype Storage buckets must not stay public.
-- New manuscripts use a separate private R2 bucket; this migration creates no Storage bucket.
update storage.buckets
set public = false, file_size_limit = 33554432,
    allowed_mime_types = array['application/json', 'application/vnd.storyforge.community-snapshot+json']
where id = 'community-intake';

create table if not exists public.community_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  kind text not null check (kind in ('novel', 'book-analysis')),
  object_path text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_length integer not null check (byte_length between 1 and 33554432),
  status text not null default 'created' check (status in ('created', 'uploaded', 'verified', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (owner_uid, idempotency_key),
  constraint owner_path check (object_path like owner_uid::text || '/%')
);

create index if not exists community_upload_sessions_owner_recent
  on public.community_upload_sessions (owner_uid, created_at desc);

alter table public.community_upload_sessions enable row level security;
revoke all on public.community_upload_sessions from anon, authenticated;
grant select on public.community_upload_sessions to authenticated;
create policy community_upload_sessions_owner_read
  on public.community_upload_sessions for select to authenticated
  using (owner_uid = (select auth.uid()));

-- R2 credentials are server-only; the authenticated Vercel endpoint signs one object PUT.

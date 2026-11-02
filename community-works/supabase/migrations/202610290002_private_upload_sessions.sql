-- Intake metadata is private. A signed Storage upload alone never publishes a work.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-intake', 'community-intake', false, 33554432,
  array['application/json', 'application/vnd.storyforge.community-snapshot+json'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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

-- No public read or broad authenticated write policy on the private bucket.
-- Signed targets are created only by the authenticated server endpoint.

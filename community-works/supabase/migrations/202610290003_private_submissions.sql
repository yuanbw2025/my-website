-- Private, immutable submission revisions. The publication table is separate.
create table if not exists public.community_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  upload_session_id uuid not null unique references public.community_upload_sessions(id),
  kind text not null check (kind in ('novel', 'book-analysis')),
  object_path text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_length integer not null check (byte_length between 1 and 33554432),
  public_pen_name text not null check (char_length(public_pen_name) between 1 and 120),
  license text not null check (license in ('all-rights-reserved', 'cc-by-4.0')),
  rights_statement_version integer not null check (rights_statement_version = 1),
  status text not null default 'submitted' check (status in
    ('submitted', 'human_review', 'needs_changes', 'rejected', 'approved', 'published', 'withdrawn', 'taken_down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submission_owner_path check (object_path like owner_uid::text || '/%')
);

create index if not exists community_submissions_owner_recent
  on public.community_submissions (owner_uid, created_at desc);
create index if not exists community_submissions_pending
  on public.community_submissions (created_at)
  where status in ('submitted', 'human_review');

alter table public.community_submissions enable row level security;
revoke all on public.community_submissions from anon, authenticated;
grant select on public.community_submissions to authenticated;
create policy community_submissions_owner_read
  on public.community_submissions for select to authenticated
  using (owner_uid = (select auth.uid()));

create table if not exists public.community_reviewers (
  uid uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('reviewer', 'senior_reviewer')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.community_reviewers enable row level security;
revoke all on public.community_reviewers from anon, authenticated;

create table if not exists public.community_moderation_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.community_submissions(id),
  actor_uid uuid not null references auth.users(id),
  revision_sha256 text not null check (revision_sha256 ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in ('begin_review', 'approve', 'needs_changes', 'reject', 'take_down')),
  reason_code text not null,
  private_note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists community_moderation_events_submission
  on public.community_moderation_events (submission_id, created_at);
alter table public.community_moderation_events enable row level security;
revoke all on public.community_moderation_events from anon, authenticated;

-- Reviewer writes must go through a server transaction that verifies reviewer
-- membership, the exact immutable revision hash, and the legal state transition.
-- No direct authenticated INSERT/UPDATE/DELETE grants are made here.

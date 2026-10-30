-- A daily operator job deletes abandoned private Storage objects after the
-- upload session's 25-hour verification window has closed. Keep a receipt.
alter table public.community_upload_sessions
  add column if not exists purged_at timestamptz;

create index if not exists community_upload_sessions_orphan_cleanup
  on public.community_upload_sessions (created_at, id)
  where status in ('created', 'failed', 'expired') and purged_at is null;

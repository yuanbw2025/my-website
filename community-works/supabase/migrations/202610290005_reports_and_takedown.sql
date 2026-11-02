-- Authenticated reader reports stay private. Filing and review are server-only
-- transactions; a public read can never expose report text or reporter identity.
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.community_publications(id),
  reporter_uid uuid not null references auth.users(id) on delete cascade,
  reason_code text not null check (reason_code in (
    'child_safety', 'sexual_violence', 'violence_threat', 'hate', 'privacy',
    'copyright', 'illegal_trade', 'other'
  )),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'escalated', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, reporter_uid, reason_code)
);
create index if not exists community_reports_queue
  on public.community_reports (created_at) where status in ('open', 'escalated');
create index if not exists community_reports_reporter_recent
  on public.community_reports (reporter_uid, created_at desc);
alter table public.community_reports enable row level security;
revoke all on public.community_reports from anon, authenticated;
grant select on public.community_reports to authenticated;
create policy community_reports_reporter_read on public.community_reports
  for select to authenticated using (reporter_uid = (select auth.uid()));

create table if not exists public.community_report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.community_reports(id),
  actor_uid uuid not null references auth.users(id),
  decision text not null check (decision in ('escalate', 'dismiss', 'take_down')),
  reason_code text not null,
  private_note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.community_report_events enable row level security;
revoke all on public.community_report_events from anon, authenticated;

create or replace function public.community_file_report(
  p_reporter_uid uuid,
  p_slug text,
  p_reason_code text,
  p_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
  existing_id uuid;
begin
  if p_reporter_uid is null or p_slug is null or p_details is null or
     p_slug !~ '^[a-z0-9-]{1,100}$' or char_length(p_details) > 2000 or
     p_reason_code is null or p_reason_code not in ('child_safety', 'sexual_violence', 'violence_threat',
       'hate', 'privacy', 'copyright', 'illegal_trade', 'other') then
    raise exception 'invalid_report' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_reporter_uid::text, 0));
  select id into target_id from public.community_publications
    where slug = p_slug and status = 'published' for update;
  if target_id is null then raise exception 'publication_not_found' using errcode = 'P0002'; end if;
  select id into existing_id from public.community_reports
    where publication_id = target_id and reporter_uid = p_reporter_uid
      and reason_code = p_reason_code;
  if existing_id is not null then return existing_id; end if;
  if (select count(*) from public.community_reports
      where reporter_uid = p_reporter_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'report_rate_limited' using errcode = '22023';
  end if;
  insert into public.community_reports (publication_id, reporter_uid, reason_code, details)
    values (target_id, p_reporter_uid, p_reason_code, p_details)
    returning id into existing_id;
  return existing_id;
end;
$$;
revoke all on function public.community_file_report(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.community_file_report(uuid, text, text, text)
  to service_role;

create or replace function public.community_review_report(
  p_actor_uid uuid,
  p_report_id uuid,
  p_decision text,
  p_reason_code text,
  p_private_note text default ''
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  report public.community_reports%rowtype;
  publication public.community_publications%rowtype;
  next_status text;
begin
  if not exists (select 1 from public.community_reviewers
      where uid = p_actor_uid and active = true) then
    raise exception 'reviewer_required' using errcode = '42501';
  end if;
  if p_private_note is null or char_length(p_private_note) > 4000 or
     p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,39}$' then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  select * into report from public.community_reports where id = p_report_id for update;
  if not found then raise exception 'report_not_found' using errcode = 'P0002'; end if;
  if report.reporter_uid = p_actor_uid then
    raise exception 'self_report_review_forbidden' using errcode = '42501';
  end if;
  if report.status not in ('open', 'escalated') then
    raise exception 'report_already_closed' using errcode = '22023';
  end if;
  select * into publication from public.community_publications
    where id = report.publication_id for update;
  if not found then raise exception 'publication_not_found' using errcode = 'P0002'; end if;

  if p_decision = 'escalate' and report.status = 'open' then
    next_status := 'escalated';
  elsif p_decision = 'dismiss' then
    next_status := 'dismissed';
  elsif p_decision = 'take_down' then
    next_status := 'actioned';
    if publication.status = 'published' then
      update public.community_publications set status = 'taken_down', updated_at = now()
        where id = publication.id;
      update public.community_submissions set status = 'taken_down', updated_at = now()
        where id = publication.submission_id and status = 'published';
      insert into public.community_moderation_events (
        submission_id, actor_uid, revision_sha256, decision, reason_code, private_note
      ) values (
        publication.submission_id, p_actor_uid, publication.approved_revision_sha256,
        'take_down', p_reason_code, p_private_note
      );
    end if;
  else
    raise exception 'invalid_report_transition' using errcode = '22023';
  end if;
  update public.community_reports set status = next_status, updated_at = now()
    where id = report.id;
  insert into public.community_report_events (
    report_id, actor_uid, decision, reason_code, private_note
  ) values (report.id, p_actor_uid, p_decision, p_reason_code, p_private_note);
  return next_status;
end;
$$;
revoke all on function public.community_review_report(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.community_review_report(uuid, uuid, text, text, text)
  to service_role;

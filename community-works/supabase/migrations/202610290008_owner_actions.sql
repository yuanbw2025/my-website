-- Authors retain control over their submission. Withdrawal atomically hides a
-- published work; appeals are private and never republish content by themselves.
create table public.community_owner_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.community_submissions(id),
  actor_uid uuid not null references auth.users(id),
  action text not null check (action = 'withdraw'),
  revision_sha256 text not null check (revision_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.community_owner_events enable row level security;
revoke all on public.community_owner_events from anon, authenticated;

create function public.community_owner_withdraw(
  p_owner_uid uuid, p_submission_id uuid, p_revision_sha256 text
) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare row_data public.community_submissions%rowtype;
begin
  select * into row_data from public.community_submissions where id = p_submission_id for update;
  if not found or row_data.owner_uid <> p_owner_uid then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;
  if row_data.sha256 <> p_revision_sha256 then
    raise exception 'revision_mismatch' using errcode = '22023';
  end if;
  if row_data.status = 'withdrawn' then return 'withdrawn'; end if;
  if row_data.status not in ('submitted', 'human_review', 'needs_changes',
      'rejected', 'approved', 'published', 'taken_down') then
    raise exception 'invalid_withdrawal' using errcode = '22023';
  end if;
  update public.community_publications set status = 'taken_down', updated_at = now()
    where submission_id = row_data.id and status = 'published';
  update public.community_submissions set status = 'withdrawn', updated_at = now()
    where id = row_data.id;
  insert into public.community_owner_events (
    submission_id, actor_uid, action, revision_sha256
  ) values (row_data.id, p_owner_uid, 'withdraw', row_data.sha256);
  return 'withdrawn';
end;
$$;
revoke all on function public.community_owner_withdraw(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.community_owner_withdraw(uuid, uuid, text) to service_role;

create table public.community_appeals (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.community_submissions(id),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  revision_sha256 text not null check (revision_sha256 ~ '^[0-9a-f]{64}$'),
  from_status text not null check (from_status in ('needs_changes', 'rejected', 'taken_down')),
  reason text not null check (char_length(reason) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'upheld', 'denied')),
  reviewer_uid uuid references auth.users(id),
  reviewer_note text not null default '' check (char_length(reviewer_note) <= 2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (submission_id)
);
create index community_appeals_queue on public.community_appeals (created_at) where status = 'open';
alter table public.community_appeals enable row level security;
revoke all on public.community_appeals from anon, authenticated;
grant select on public.community_appeals to authenticated;
create policy community_appeals_owner on public.community_appeals for select to authenticated
  using (owner_uid = (select auth.uid()));

create function public.community_file_appeal(
  p_owner_uid uuid, p_submission_id uuid, p_revision_sha256 text, p_reason text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  row_data public.community_submissions%rowtype;
  existing_id uuid;
begin
  if p_reason is null or char_length(trim(p_reason)) not between 1 and 2000 then
    raise exception 'invalid_appeal' using errcode = '22023';
  end if;
  select * into row_data from public.community_submissions where id = p_submission_id for update;
  if not found or row_data.owner_uid <> p_owner_uid then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;
  if row_data.sha256 <> p_revision_sha256 then
    raise exception 'revision_mismatch' using errcode = '22023';
  end if;
  select id into existing_id from public.community_appeals where submission_id = p_submission_id;
  if existing_id is not null then return existing_id; end if;
  if row_data.status not in ('needs_changes', 'rejected', 'taken_down') then
    raise exception 'appeal_not_allowed' using errcode = '22023';
  end if;
  insert into public.community_appeals (
    submission_id, owner_uid, revision_sha256, from_status, reason
  ) values (row_data.id, p_owner_uid, row_data.sha256, row_data.status, trim(p_reason))
    returning id into existing_id;
  return existing_id;
end;
$$;
revoke all on function public.community_file_appeal(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.community_file_appeal(uuid, uuid, text, text) to service_role;

create function public.community_review_appeal(
  p_actor_uid uuid, p_appeal_id uuid, p_decision text, p_reviewer_note text
) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare row_data public.community_appeals%rowtype;
begin
  if not exists (select 1 from public.community_reviewers
      where uid = p_actor_uid and active = true) then
    raise exception 'reviewer_required' using errcode = '42501';
  end if;
  if p_decision not in ('upheld', 'denied') or p_reviewer_note is null or
     char_length(trim(p_reviewer_note)) not between 1 and 2000 then
    raise exception 'invalid_appeal_decision' using errcode = '22023';
  end if;
  select * into row_data from public.community_appeals where id = p_appeal_id for update;
  if not found then raise exception 'appeal_not_found' using errcode = 'P0002'; end if;
  if row_data.owner_uid = p_actor_uid then
    raise exception 'self_review_forbidden' using errcode = '42501';
  end if;
  if row_data.status <> 'open' then
    raise exception 'appeal_already_closed' using errcode = '22023';
  end if;
  update public.community_appeals set status = p_decision,
    reviewer_uid = p_actor_uid, reviewer_note = trim(p_reviewer_note), reviewed_at = now()
    where id = row_data.id;
  return p_decision;
end;
$$;
revoke all on function public.community_review_appeal(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.community_review_appeal(uuid, uuid, text, text) to service_role;

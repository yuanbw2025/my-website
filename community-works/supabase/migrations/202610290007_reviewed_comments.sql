-- Comments are private until an independent human decision publishes that revision.
create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.community_publications(id),
  author_uid uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  body text not null check (char_length(body) between 1 and 1200 and octet_length(body) <= 4800),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'taken_down')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (author_uid, idempotency_key)
);
create index community_comments_public on public.community_comments (publication_id, created_at, id)
  where status = 'approved';
create index community_comments_queue on public.community_comments (created_at, id)
  where status = 'pending';
create index community_comments_author_recent on public.community_comments (author_uid, created_at desc);
alter table public.community_comments enable row level security;
revoke all on public.community_comments from anon, authenticated;
grant select on public.community_comments to anon, authenticated;
create policy community_comments_visible on public.community_comments for select to anon, authenticated
  using (status = 'approved' and exists (
    select 1 from public.community_publications p
      where p.id = publication_id and p.status = 'published' and p.published_at is not null
  ));
create policy community_comments_owner on public.community_comments for select to authenticated
  using (author_uid = (select auth.uid()));

create function public.community_read_comments(p_slug text, p_offset integer, p_limit integer)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9-]{1,100}$' or p_offset is null or
     p_offset not between 0 and 1000000 or p_limit is null or p_limit not between 1 and 50 then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'displayName', display_name, 'body', body, 'createdAt', created_at
  ) order by created_at, id), '[]'::jsonb) into result from (
    select c.id, c.display_name, c.body, c.created_at
    from public.community_comments c
    join public.community_publications p on p.id = c.publication_id
    where p.slug = p_slug and p.status = 'published' and c.status = 'approved'
    order by c.created_at, c.id offset p_offset limit p_limit
  ) page;
  return result;
end;
$$;
revoke all on function public.community_read_comments(text, integer, integer) from public;
grant execute on function public.community_read_comments(text, integer, integer) to anon, authenticated;

create table public.community_comment_events (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.community_comments(id),
  actor_uid uuid not null references auth.users(id),
  decision text not null check (decision in ('approve', 'reject', 'take_down')),
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_]{1,39}$'),
  private_note text not null default '' check (char_length(private_note) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.community_comment_events enable row level security;
revoke all on public.community_comment_events from anon, authenticated;

create function public.community_file_comment(
  p_author_uid uuid, p_slug text, p_idempotency_key uuid,
  p_display_name text, p_body text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target_id uuid;
  previous public.community_comments%rowtype;
  result_id uuid;
begin
  if p_author_uid is null or p_idempotency_key is null or p_slug is null or
     p_slug !~ '^[a-z0-9-]{1,100}$' or p_display_name is null or
     char_length(trim(p_display_name)) not between 1 and 80 or
     p_body is null or char_length(trim(p_body)) not between 1 and 1200 or
     octet_length(p_body) > 4800 then
    raise exception 'invalid_comment' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_author_uid::text, 0));
  select * into previous from public.community_comments
    where author_uid = p_author_uid and idempotency_key = p_idempotency_key;
  if found then
    select id into target_id from public.community_publications where slug = p_slug;
    if previous.publication_id <> target_id or previous.display_name <> trim(p_display_name) or
       previous.body <> trim(p_body) then
      raise exception 'idempotency_conflict' using errcode = '22023';
    end if;
    return previous.id;
  end if;
  select id into target_id from public.community_publications
    where slug = p_slug and status = 'published' and published_at is not null;
  if target_id is null then raise exception 'publication_not_found' using errcode = 'P0002'; end if;
  if (select count(*) from public.community_comments
      where author_uid = p_author_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'comment_rate_limited' using errcode = '22023';
  end if;
  insert into public.community_comments (
    publication_id, author_uid, idempotency_key, display_name, body
  ) values (target_id, p_author_uid, p_idempotency_key, trim(p_display_name), trim(p_body))
    returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.community_file_comment(uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.community_file_comment(uuid, text, uuid, text, text) to service_role;

create function public.community_review_comment(
  p_actor_uid uuid, p_comment_id uuid, p_decision text,
  p_reason_code text, p_private_note text default ''
) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  comment_row public.community_comments%rowtype;
  next_status text;
begin
  if not exists (select 1 from public.community_reviewers
      where uid = p_actor_uid and active = true) then
    raise exception 'reviewer_required' using errcode = '42501';
  end if;
  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,39}$' or
     p_private_note is null or char_length(p_private_note) > 2000 then
    raise exception 'invalid_review' using errcode = '22023';
  end if;
  select * into comment_row from public.community_comments where id = p_comment_id for update;
  if not found then raise exception 'comment_not_found' using errcode = 'P0002'; end if;
  if comment_row.author_uid = p_actor_uid then
    raise exception 'self_review_forbidden' using errcode = '42501';
  end if;
  if p_decision = 'approve' and comment_row.status = 'pending' then
    if not exists (select 1 from public.community_publications
        where id = comment_row.publication_id and status = 'published') then
      raise exception 'publication_not_visible' using errcode = '22023';
    end if;
    next_status := 'approved';
  elsif p_decision = 'reject' and comment_row.status = 'pending' then
    next_status := 'rejected';
  elsif p_decision = 'take_down' and comment_row.status = 'approved' then
    next_status := 'taken_down';
  else
    raise exception 'invalid_comment_transition' using errcode = '22023';
  end if;
  update public.community_comments set status = next_status, reviewed_at = now()
    where id = comment_row.id;
  insert into public.community_comment_events (
    comment_id, actor_uid, decision, reason_code, private_note
  ) values (comment_row.id, p_actor_uid, p_decision, p_reason_code, p_private_note);
  return next_status;
end;
$$;
revoke all on function public.community_review_comment(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.community_review_comment(uuid, uuid, text, text, text) to service_role;

create table public.community_comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.community_comments(id),
  reporter_uid uuid not null references auth.users(id) on delete cascade,
  reason_code text not null check (reason_code in (
    'child_safety', 'sexual_violence', 'violence_threat', 'hate', 'privacy', 'other'
  )),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comment_id, reporter_uid, reason_code)
);
create index community_comment_reports_queue on public.community_comment_reports (created_at)
  where status = 'open';
alter table public.community_comment_reports enable row level security;
revoke all on public.community_comment_reports from anon, authenticated;
grant select on public.community_comment_reports to authenticated;
create policy community_comment_reports_owner on public.community_comment_reports
  for select to authenticated using (reporter_uid = (select auth.uid()));

create table public.community_comment_report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.community_comment_reports(id),
  actor_uid uuid not null references auth.users(id),
  decision text not null check (decision in ('dismiss', 'take_down')),
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_]{1,39}$'),
  private_note text not null default '' check (char_length(private_note) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.community_comment_report_events enable row level security;
revoke all on public.community_comment_report_events from anon, authenticated;

create function public.community_file_comment_report(
  p_reporter_uid uuid, p_comment_id uuid, p_reason_code text, p_details text default ''
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  existing_id uuid;
begin
  if p_reporter_uid is null or p_comment_id is null or p_details is null or
     char_length(p_details) > 2000 or p_reason_code is null or
     p_reason_code not in ('child_safety', 'sexual_violence', 'violence_threat', 'hate', 'privacy', 'other') then
    raise exception 'invalid_comment_report' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_reporter_uid::text, 0));
  if not exists (select 1 from public.community_comments c
      join public.community_publications p on p.id = c.publication_id
      where c.id = p_comment_id and c.status = 'approved' and
        p.status = 'published' and p.published_at is not null) then
    raise exception 'comment_not_visible' using errcode = 'P0002';
  end if;
  select id into existing_id from public.community_comment_reports
    where comment_id = p_comment_id and reporter_uid = p_reporter_uid and reason_code = p_reason_code;
  if existing_id is not null then return existing_id; end if;
  if (select count(*) from public.community_comment_reports
      where reporter_uid = p_reporter_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'report_rate_limited' using errcode = '22023';
  end if;
  insert into public.community_comment_reports (comment_id, reporter_uid, reason_code, details)
    values (p_comment_id, p_reporter_uid, p_reason_code, p_details)
    returning id into existing_id;
  return existing_id;
end;
$$;
revoke all on function public.community_file_comment_report(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.community_file_comment_report(uuid, uuid, text, text) to service_role;

create function public.community_review_comment_report(
  p_actor_uid uuid, p_report_id uuid, p_decision text,
  p_reason_code text, p_private_note text default ''
) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  report_row public.community_comment_reports%rowtype;
  comment_row public.community_comments%rowtype;
  next_status text;
begin
  if not exists (select 1 from public.community_reviewers
      where uid = p_actor_uid and active = true) then
    raise exception 'reviewer_required' using errcode = '42501';
  end if;
  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,39}$' or
     p_private_note is null or char_length(p_private_note) > 2000 then
    raise exception 'invalid_review' using errcode = '22023';
  end if;
  select * into report_row from public.community_comment_reports
    where id = p_report_id for update;
  if not found then raise exception 'report_not_found' using errcode = 'P0002'; end if;
  if report_row.reporter_uid = p_actor_uid then
    raise exception 'self_report_review_forbidden' using errcode = '42501';
  end if;
  if report_row.status <> 'open' then
    raise exception 'report_already_closed' using errcode = '22023';
  end if;
  select * into comment_row from public.community_comments
    where id = report_row.comment_id for update;
  if comment_row.author_uid = p_actor_uid then
    raise exception 'self_review_forbidden' using errcode = '42501';
  end if;
  if p_decision = 'take_down' then
    if comment_row.status <> 'approved' then
      raise exception 'comment_not_visible' using errcode = '22023';
    end if;
    update public.community_comments set status = 'taken_down', reviewed_at = now()
      where id = comment_row.id;
    insert into public.community_comment_events (
      comment_id, actor_uid, decision, reason_code, private_note
    ) values (comment_row.id, p_actor_uid, 'take_down', p_reason_code, p_private_note);
    next_status := 'actioned';
  elsif p_decision = 'dismiss' then
    next_status := 'dismissed';
  else
    raise exception 'invalid_report_transition' using errcode = '22023';
  end if;
  update public.community_comment_reports set status = next_status, updated_at = now()
    where id = report_row.id;
  insert into public.community_comment_report_events (
    report_id, actor_uid, decision, reason_code, private_note
  ) values (report_row.id, p_actor_uid, p_decision, p_reason_code, p_private_note);
  return next_status;
end;
$$;
revoke all on function public.community_review_comment_report(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.community_review_comment_report(uuid, uuid, text, text, text) to service_role;

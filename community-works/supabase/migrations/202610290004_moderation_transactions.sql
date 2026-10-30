-- Every public transition is bound to one immutable submission revision and
-- committed with its audit event. Only the server role may call this function.
alter table public.community_publications
  add column if not exists submission_id uuid unique references public.community_submissions(id);
alter table public.community_publications
  add column if not exists toc jsonb not null default '{}'::jsonb
  check (jsonb_typeof(toc) = 'object');

alter table public.community_moderation_events
  drop constraint if exists community_moderation_events_decision_check;
alter table public.community_moderation_events
  add constraint community_moderation_events_decision_check
  check (decision in ('begin_review', 'approve', 'needs_changes', 'reject', 'publish', 'take_down'));

create or replace function public.community_review_transition(
  p_actor_uid uuid,
  p_submission_id uuid,
  p_revision_sha256 text,
  p_decision text,
  p_reason_code text,
  p_private_note text default '',
  p_publication jsonb default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  submission public.community_submissions%rowtype;
  reviewer_role text;
  next_status text;
  public_slug text;
begin
  select role into reviewer_role
    from public.community_reviewers
    where uid = p_actor_uid and active = true;
  if reviewer_role is null then raise exception 'reviewer_required' using errcode = '42501'; end if;
  if p_reason_code is null or p_private_note is null or
     p_reason_code !~ '^[a-z][a-z0-9_]{1,39}$' or
     char_length(p_private_note) > 4000 then
    raise exception 'invalid_moderation_reason' using errcode = '22023';
  end if;

  select * into submission from public.community_submissions
    where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found' using errcode = 'P0002'; end if;
  if p_revision_sha256 is null or submission.sha256 <> p_revision_sha256 then
    raise exception 'revision_mismatch' using errcode = '22023';
  end if;
  if submission.owner_uid = p_actor_uid then
    raise exception 'self_review_forbidden' using errcode = '42501';
  end if;

  if p_decision = 'begin_review' and submission.status = 'submitted' then
    next_status := 'human_review';
  elsif p_decision = 'approve' and submission.status = 'human_review' then
    next_status := 'approved';
  elsif p_decision = 'needs_changes' and submission.status = 'human_review' then
    next_status := 'needs_changes';
  elsif p_decision = 'reject' and submission.status = 'human_review' then
    next_status := 'rejected';
  elsif p_decision = 'publish' and submission.status = 'approved' then
    next_status := 'published';
  elsif p_decision = 'take_down' and submission.status = 'published' then
    next_status := 'taken_down';
  else
    raise exception 'invalid_moderation_transition' using errcode = '22023';
  end if;

  if p_decision = 'publish' then
    if p_publication is null or
       jsonb_typeof(p_publication) <> 'object' or
       p_publication ->> 'kind' <> submission.kind or
       nullif(trim(p_publication ->> 'title'), '') is null or
       char_length(p_publication ->> 'title') > 300 or
       char_length(coalesce(p_publication ->> 'description', '')) > 4000 or
       p_publication ->> 'objectPath' is distinct from
         'published/' || submission.id::text || '/' || submission.sha256 || '/snapshot.json' or
       jsonb_typeof(p_publication -> 'toc') <> 'object' or
       char_length(coalesce(p_publication ->> 'language', '')) > 30 then
      raise exception 'invalid_publication' using errcode = '22023';
    end if;
    public_slug := 'work-' || replace(submission.id::text, '-', '');
    insert into public.community_publications (
      submission_id, slug, kind, title, description, author_name, language,
      object_path, toc, status, approved_revision_sha256, published_at, updated_at
    ) values (
      submission.id, public_slug, submission.kind, p_publication ->> 'title',
      coalesce(p_publication ->> 'description', ''), submission.public_pen_name,
      coalesce(nullif(p_publication ->> 'language', ''), 'zh-CN'),
      p_publication ->> 'objectPath', p_publication -> 'toc',
      'published', submission.sha256, now(), now()
    );
  elsif p_publication is not null then
    raise exception 'unexpected_publication' using errcode = '22023';
  end if;

  if p_decision = 'take_down' then
    update public.community_publications
      set status = 'taken_down', updated_at = now()
      where submission_id = submission.id and status = 'published'
        and approved_revision_sha256 = submission.sha256;
    if not found then raise exception 'publication_not_found' using errcode = 'P0002'; end if;
  end if;

  update public.community_submissions
    set status = next_status, updated_at = now()
    where id = submission.id;
  insert into public.community_moderation_events (
    submission_id, actor_uid, revision_sha256, decision, reason_code, private_note
  ) values (
    submission.id, p_actor_uid, submission.sha256, p_decision, p_reason_code, p_private_note
  );
  return next_status;
end;
$$;

revoke all on function public.community_review_transition(uuid, uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.community_review_transition(uuid, uuid, text, text, text, text, jsonb)
  to service_role;

-- The public API resolves a private R2 object only after this invoker-RLS check.
-- No manuscript body is stored in Postgres or returned by this function.
create or replace function public.community_read_part(
  p_slug text,
  p_section_index integer,
  p_entry_index integer,
  p_part_index integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  publication public.community_publications%rowtype;
  section jsonb;
begin
  if p_slug is null or p_section_index is null or p_entry_index is null or p_part_index is null or
     p_slug !~ '^[a-z0-9-]{1,100}$' or
     p_section_index not between 0 and 10000000 or
     p_entry_index not between 0 and 10000000 or
     p_part_index not between 0 and 1000 then
    return null;
  end if;
  select * into publication from public.community_publications
    where slug = p_slug and status = 'published' and published_at is not null;
  if not found then return null; end if;
  if publication.kind = 'novel' and p_entry_index = 0 then
    section := publication.toc -> 'chapters' -> p_section_index;
  elsif publication.kind = 'book-analysis' and p_section_index = 13 and p_entry_index = 0 and
      publication.toc ->> 'hasAuthorCommentary' = 'true' then
    section := publication.toc;
  elsif publication.kind = 'book-analysis' and p_section_index between 0 and 12 then
    section := publication.toc -> 'dimensions' -> p_section_index -> 'entries' -> p_entry_index;
  end if;
  if section is null then return null; end if;
  return jsonb_build_object('objectPath', publication.object_path,
    'sha256', publication.approved_revision_sha256, 'kind', publication.kind);
end;
$$;

revoke all on function public.community_read_part(text, integer, integer, integer) from public;
grant execute on function public.community_read_part(text, integer, integer, integer)
  to anon, authenticated;

create or replace function public.community_read_toc_page(
  p_slug text,
  p_section_index integer,
  p_offset integer,
  p_limit integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  publication public.community_publications%rowtype;
  source jsonb;
  item jsonb;
  items jsonb := '[]'::jsonb;
  total integer;
  idx integer;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9-]{1,100}$' or
     p_section_index is null or p_offset is null or p_limit is null or
     p_section_index not between -1 and 12 or
     p_offset not between 0 and 10000000 or p_limit not between 1 and 100 then
    return null;
  end if;
  select * into publication from public.community_publications
    where slug = p_slug and status = 'published' and published_at is not null;
  if not found then return null; end if;

  if publication.kind = 'novel' and p_section_index = -1 then
    source := publication.toc -> 'chapters';
  elsif publication.kind = 'book-analysis' and p_section_index = -1 then
    source := publication.toc -> 'dimensions';
  elsif publication.kind = 'book-analysis' then
    source := publication.toc -> 'dimensions' -> p_section_index -> 'entries';
  else
    return null;
  end if;
  if jsonb_typeof(source) <> 'array' then return null; end if;
  total := jsonb_array_length(source);
  if p_offset < total then
    for idx in p_offset..least(total - 1, p_offset + p_limit - 1) loop
      item := source -> idx;
      if publication.kind = 'novel' then
        items := items || jsonb_build_array(jsonb_build_object('index', idx, 'title', item ->> 'title'));
      elsif p_section_index = -1 then
        items := items || jsonb_build_array(jsonb_build_object(
          'index', idx, 'key', item ->> 'key', 'label', item ->> 'label',
          'selected', item -> 'selected', 'entryCount', jsonb_array_length(item -> 'entries')
        ));
      else
        items := items || jsonb_build_array(jsonb_build_object('index', idx, 'label', item ->> 'label'));
      end if;
    end loop;
  end if;
  return jsonb_build_object(
    'kind', publication.kind, 'total', total, 'items', items,
    'hasAuthorCommentary', coalesce((publication.toc ->> 'hasAuthorCommentary')::boolean, false)
  );
end;
$$;

revoke all on function public.community_read_toc_page(text, integer, integer, integer) from public;
grant execute on function public.community_read_toc_page(text, integer, integer, integer)
  to anon, authenticated;

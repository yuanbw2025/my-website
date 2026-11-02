-- Human and model approvals share exactly one publication projection writer.
create function public.community_publish_reviewed_submission(p_submission_id uuid,p_publication jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare submission public.community_submissions%rowtype; public_slug text;
begin
 select * into submission from public.community_submissions where id=p_submission_id and status='approved' for update;
 if not found then raise exception 'approved_submission_required'; end if;
    if p_publication is null or
       jsonb_typeof(p_publication) <> 'object' or
       p_publication ->> 'kind' <> submission.kind or
       nullif(trim(p_publication ->> 'title'), '') is null or
       char_length(p_publication ->> 'title') > 300 or
       char_length(coalesce(p_publication ->> 'description', '')) > 4000 or
       p_publication ->> 'objectPath' is distinct from submission.object_path or
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
end $$;
revoke all on function public.community_publish_reviewed_submission(uuid,jsonb) from public,anon,authenticated,service_role;

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
    perform public.community_publish_reviewed_submission(submission.id,p_publication);
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

create function public.community_automod_publish(p_job uuid,p_lease uuid,p_publish_enabled boolean)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg public.community_automod_settings%rowtype; j public.community_automod_jobs%rowtype;
 s public.community_submissions%rowtype; c public.community_comments%rowtype; total integer;
begin
 select * into cfg from public.community_automod_settings where singleton for update;
 select * into j from public.community_automod_jobs where id=p_job and lease=p_lease and lease_until>now() and state='processing' for update;
 if not found or cfg.lease is distinct from p_lease then raise exception 'invalid_lease'; end if;
 if not cfg.enabled or not cfg.auto_publish or p_publish_enabled is distinct from true then
  update public.community_automod_jobs set state='clear',lease=null,lease_until=null,updated_at=now() where id=j.id;
  update public.community_automod_settings set lease=null,lease_until=null where singleton;
  return 'publishing_paused';
 end if;
 total:=jsonb_array_length(j.unit_hashes);
 if total is null or total<2 or j.next_unit<>total or
  (select count(*) from public.community_automod_attempts where job_id=j.id and status='clear')<>total or
  exists(select 1 from public.community_automod_attempts a where a.job_id=j.id and
   (a.status<>'clear' or a.input_sha256 is distinct from j.unit_hashes->>a.unit_index or a.response_sha256 is null or a.categories<>'[]'::jsonb)) then
  raise exception 'incomplete_model_review';
 end if;
 if j.submission_id is not null then
  select * into s from public.community_submissions where id=j.submission_id for update;
  if not found or s.status<>'submitted' or s.sha256<>j.revision_sha256 then raise exception 'stale_submission'; end if;
  update public.community_submissions set status='approved',updated_at=now() where id=s.id;
  insert into public.community_moderation_events(submission_id,actor_type,automation_job_id,revision_sha256,decision,reason_code)
   values(s.id,'model',j.id,s.sha256,'approve','automated_clear');
  perform public.community_publish_reviewed_submission(s.id,j.public_projection);
  update public.community_submissions set status='published',updated_at=now() where id=s.id;
  insert into public.community_moderation_events(submission_id,actor_type,automation_job_id,revision_sha256,decision,reason_code)
   values(s.id,'model',j.id,s.sha256,'publish','automated_clear');
 else
  select * into c from public.community_comments where id=j.comment_id for update;
  if not found or c.status<>'pending' or public.community_comment_revision(c)<>j.revision_sha256 then raise exception 'stale_comment'; end if;
  perform 1 from public.community_publications where id=c.publication_id and status='published' for share;
  if not found then raise exception 'publication_not_visible'; end if;
  if c.parent_id is not null then
   perform 1 from public.community_comments where id=c.parent_id and status='approved' for share;
   if not found then raise exception 'parent_not_visible'; end if;
  end if;
  update public.community_comments set status='approved',reviewed_at=now() where id=c.id;
  insert into public.community_comment_events(comment_id,actor_type,automation_job_id,decision,reason_code)
   values(c.id,'model',j.id,'approve','automated_clear');
 end if;
 update public.community_automod_jobs set state='published',lease=null,lease_until=null,updated_at=now() where id=j.id;
 update public.community_automod_settings set lease=null,lease_until=null where singleton;
 return 'published';
end $$;
revoke all on function public.community_automod_publish(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.community_automod_publish(uuid,uuid,boolean) to service_role;


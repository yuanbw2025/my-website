-- A v2 comment inserts its body, then attaches its selection/parent in the same
-- transaction. Freeze the revision after that transaction, not halfway through
-- it. Later edits still fail the existing immutable-revision check.
create function public.community_enqueue_final_comment() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare comment_row public.community_comments%rowtype;
begin
 select * into comment_row from public.community_comments where id=new.id;
 if found and comment_row.status='pending' then
  insert into public.community_automod_jobs(comment_id,revision_sha256)
   values(comment_row.id,public.community_comment_revision(comment_row)) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.community_enqueue_final_comment() from public,anon,authenticated,service_role;
drop trigger community_comment_automod on public.community_comments;
create constraint trigger community_comment_automod
 after insert on public.community_comments deferrable initially deferred
 for each row execute function public.community_enqueue_final_comment();
-- Do not rewrite existing job revisions, attempts or audit history. Previously
-- stale comments remain available to human review and are not silently retried.

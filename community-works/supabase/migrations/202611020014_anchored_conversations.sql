alter table public.community_comments add column parent_id uuid references public.community_comments(id);
alter table public.community_comments add column anchor jsonb;
alter table public.community_comments add constraint community_comment_anchor_shape check (
  anchor is null or (jsonb_typeof(anchor) = 'object' and anchor->>'version' = '1'
    and anchor->>'revisionHash' ~ '^[0-9a-f]{64}$' and anchor->>'section' ~ '^\d{1,8}$'
    and anchor->>'entry' ~ '^\d{1,8}$' and anchor->>'kind' in ('section','paragraph','selection'))
);
create index community_comment_threads on public.community_comments(publication_id,parent_id,created_at,id) where status = 'approved';

create function public.community_conversation(p_slug text,p_actor_uid uuid default null,
  p_filter jsonb default '{}',p_parent uuid default null,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare items jsonb;
begin
  if p_offset is null or p_offset not between 0 and 1000000 then return jsonb_build_object('error','invalid_page'); end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (
    select c.id,c.display_name as "displayName",c.body,c.created_at as "createdAt",c.anchor,c.parent_id as "parentId",
      coalesce(c.author_uid = w.owner_uid,false) as "isAuthor",coalesce(c.author_uid = p_actor_uid,false) as mine,
      (select count(*) from public.community_comments r where r.parent_id = c.id and r.status = 'approved'
        and not exists(select 1 from public.community_blocks b where
          (b.actor_uid = p_actor_uid and b.blocked_uid = r.author_uid) or (b.blocked_uid = p_actor_uid and b.actor_uid = r.author_uid))) as replies
    from public.community_comments c join public.community_publications p on p.id = c.publication_id
      join public.community_works w on w.id = p.community_work_id
    where p.slug = p_slug and p.status = 'published' and c.status = 'approved'
      and (case when p_filter ? 'commentId' then c.id::text = p_filter->>'commentId' else c.parent_id is not distinct from p_parent end)
      and (c.parent_id is null or exists(select 1 from public.community_comments root where root.id = c.parent_id and root.status = 'approved'
        and not exists(select 1 from public.community_blocks b where
          (b.actor_uid = p_actor_uid and b.blocked_uid = root.author_uid) or (b.blocked_uid = p_actor_uid and b.actor_uid = root.author_uid))))
      and (p_filter ? 'commentId' or p_parent is not null or case when p_filter ? 'section' then
        c.anchor->>'section' = p_filter->>'section' and c.anchor->>'entry' = p_filter->>'entry'
        and (not (p_filter ? 'block') or c.anchor->>'block' = p_filter->>'block') else c.anchor is null end)
      and not exists(select 1 from public.community_blocks b where
        (b.actor_uid = p_actor_uid and b.blocked_uid = c.author_uid) or (b.blocked_uid = p_actor_uid and b.actor_uid = c.author_uid))
    order by c.created_at,c.id offset p_offset limit 50
  ) x;
  return jsonb_build_object('items',items);
end $$;

create function public.community_file_comment_v2(p_author_uid uuid,p_slug text,p_idempotency_key uuid,
  p_display_name text,p_body text,p_anchor jsonb default null,p_parent uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.community_publications%rowtype; c public.community_comments%rowtype;
  root public.community_comments%rowtype; owner_id uuid; cid uuid;
begin
  if p_author_uid is null then return jsonb_build_object('error','authentication_required'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_author_uid::text,0));
  select * into p from public.community_publications where slug = p_slug and status = 'published' for share;
  if not found then return jsonb_build_object('error','work_not_available'); end if;
  select owner_uid into owner_id from public.community_works where id = p.community_work_id;
  if exists(select 1 from public.community_blocks where (actor_uid = p_author_uid and blocked_uid = owner_id)
    or (blocked_uid = p_author_uid and actor_uid = owner_id)) then return jsonb_build_object('error','interaction_unavailable'); end if;
  if p_parent is not null then
    select * into root from public.community_comments where id = p_parent and publication_id = p.id and status = 'approved' and parent_id is null for share;
    if not found or p_anchor is distinct from root.anchor then return jsonb_build_object('error','invalid_reply'); end if;
    if exists(select 1 from public.community_blocks where (actor_uid = p_author_uid and blocked_uid = root.author_uid)
      or (blocked_uid = p_author_uid and actor_uid = root.author_uid)) then return jsonb_build_object('error','interaction_unavailable'); end if;
  end if;
  if p_anchor is not null and (p_anchor->>'revisionId' is distinct from p.id::text or
    p_anchor->>'revisionHash' is distinct from p.approved_revision_sha256) then return jsonb_build_object('error','revision_mismatch'); end if;
  select * into c from public.community_comments where author_uid = p_author_uid and idempotency_key = p_idempotency_key;
  if found then
    if c.publication_id <> p.id or c.body <> p_body or c.display_name <> p_display_name or
      c.anchor is distinct from p_anchor or c.parent_id is distinct from p_parent then
      return jsonb_build_object('error','idempotency_conflict');
    end if;
    return jsonb_build_object('commentId',c.id,'status',c.status,'replayed',true);
  end if;
  cid := public.community_file_comment(p_author_uid,p_slug,p_idempotency_key,p_display_name,p_body);
  update public.community_comments set anchor = p_anchor,parent_id = p_parent where id = cid;
  return jsonb_build_object('commentId',cid,'status','pending');
end $$;

create function public.community_comment_social_events() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare recipient uuid; owner_id uuid;
begin
  if new.status = 'approved' and old.status <> 'approved' then
    if new.parent_id is not null then
      select author_uid into recipient from public.community_comments where id = new.parent_id and status = 'approved' and parent_id is null;
      if not found then raise exception 'reply_parent_unavailable'; end if;
    end if;
    select w.owner_uid into owner_id from public.community_works w join public.community_publications p on p.community_work_id = w.id where p.id = new.publication_id;
    if exists(select 1 from public.community_blocks b where
      (b.actor_uid = new.author_uid and b.blocked_uid in (recipient,owner_id)) or
      (b.blocked_uid = new.author_uid and b.actor_uid in (recipient,owner_id))) then raise exception 'interaction_unavailable'; end if;
    if recipient is not null and recipient <> new.author_uid then
      insert into public.community_notifications(recipient_uid,kind,publication_id,comment_id,source_actor_uid,event_key)
        values(recipient,'reply',new.publication_id,new.id,new.author_uid,'comment:'||new.id::text) on conflict do nothing;
    end if;
    if owner_id is not null and owner_id <> new.author_uid then
      insert into public.community_notifications(recipient_uid,kind,publication_id,comment_id,source_actor_uid,event_key)
        values(owner_id,'comment',new.publication_id,new.id,new.author_uid,'comment:'||new.id::text) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
create trigger community_comment_social_events before update of status on public.community_comments
  for each row execute function public.community_comment_social_events();

create function public.community_withdraw_comment(p_actor_uid uuid,p_comment_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.community_comments%rowtype;
begin
  select * into c from public.community_comments where id = p_comment_id and author_uid = p_actor_uid for update;
  if not found then return jsonb_build_object('error','comment_not_found'); end if;
  if c.status in ('pending','approved') then
    update public.community_comments set status = 'taken_down',reviewed_at = now() where id = c.id;
    insert into public.community_comment_events(comment_id,actor_uid,decision,reason_code,private_note)
      values(c.id,p_actor_uid,'take_down','author_withdrawal','');
  end if;
  return jsonb_build_object('ok',true);
end $$;

-- Protect raw Auth identifiers and idempotency keys from public table reads.
-- These two invoker RPCs need SELECT internally, so replace their public entry
-- with narrowly projected security-definer wrappers before revoking table access.
alter function public.community_read_comments(text,integer,integer) security definer;
revoke select on public.community_comments from anon,authenticated;
revoke all on function public.community_comment_social_events() from public,anon,authenticated,service_role;
revoke all on function public.community_conversation(text,uuid,jsonb,uuid,integer),
  public.community_file_comment_v2(uuid,text,uuid,text,text,jsonb,uuid),public.community_withdraw_comment(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.community_conversation(text,uuid,jsonb,uuid,integer),
  public.community_file_comment_v2(uuid,text,uuid,text,text,jsonb,uuid),public.community_withdraw_comment(uuid,uuid) to service_role;

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
    'sha256', publication.approved_revision_sha256, 'kind', publication.kind,
    'revisionId', publication.id);
end;
$$;

revoke all on function public.community_read_part(text, integer, integer, integer) from public;
grant execute on function public.community_read_part(text, integer, integer, integer)
  to anon, authenticated;


create or replace function public.community_read_comments(p_slug text,p_offset integer,p_limit integer)
returns jsonb language sql security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
    select c.id,c.display_name as "displayName",c.body,c.created_at as "createdAt"
    from public.community_comments c join public.community_publications p on p.id=c.publication_id
    where p.slug=p_slug and p.status='published' and c.status='approved' and c.parent_id is null and c.anchor is null
      and p_offset between 0 and 1000000 and p_limit between 1 and 50
    order by c.created_at,c.id offset greatest(0,least(coalesce(p_offset,0),1000000)) limit greatest(0,least(coalesce(p_limit,0),50))
  ) x
$$;

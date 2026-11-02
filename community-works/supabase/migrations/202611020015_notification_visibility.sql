-- Hide replies when their root comment is withdrawn or moderated.
create or replace function public.community_social_private(p_actor_uid uuid,p_scope text,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare items jsonb; today date := (now() at time zone 'Asia/Shanghai')::date;
begin
  if p_actor_uid is null or p_offset is null or p_offset not between 0 and 1000000 then return jsonb_build_object('error','invalid_page'); end if;
  if p_scope = 'wallet' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (
      select l.id,l.kind,l.amount,l.balance_after as "balanceAfter",l.created_at as "createdAt",
        case when p.status = 'published' then p.title else null end as title,
        case when p.status = 'published' then p.slug else null end as slug
      from public.community_flower_ledger l left join public.community_works w on w.id = l.work_id
      left join public.community_publications p on p.id = w.current_publication_id
      where l.actor_uid = p_actor_uid order by l.created_at desc,l.id desc offset p_offset limit 50
    ) x;
    return jsonb_build_object('items',items,'balance',coalesce((select balance from public.community_flower_wallets where actor_uid = p_actor_uid),0),
      'claimed',exists(select 1 from public.community_flower_ledger where actor_uid = p_actor_uid and claim_day = today),'day',today);
  elsif p_scope = 'shelf' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (
      select w.id as "workId",b.following,case when p.status = 'published' then p.title else '作品暂不可访问' end as title,
        case when p.status = 'published' then p.slug else null end as slug,
        case when old.status = 'published' then old.slug else null end as "resumeSlug",
        r.section_index as section,r.entry_index as entry,r.block_index as block,
        coalesce(r.publication_id <> p.id,false) as updated
      from public.community_bookshelf b join public.community_works w on w.id = b.work_id
      join public.community_publications p on p.id = w.current_publication_id
      left join public.community_reading_progress r on r.actor_uid = b.actor_uid and r.work_id = b.work_id
      left join public.community_publications old on old.id = r.publication_id
      where b.actor_uid = p_actor_uid order by b.created_at desc,b.work_id offset p_offset limit 50
    ) x;
  elsif p_scope = 'notifications' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (
      select n.id,n.kind,n.quantity,n.read_at as "readAt",n.created_at as "createdAt",
        case when p.status = 'published' and (n.comment_id is null or (c.status = 'approved' and (c.parent_id is null or exists(select 1 from public.community_comments root where root.id = c.parent_id and root.status = 'approved')))) then p.title else '内容暂不可访问' end as title,
        case when p.status = 'published' and (n.comment_id is null or (c.status = 'approved' and (c.parent_id is null or exists(select 1 from public.community_comments root where root.id = c.parent_id and root.status = 'approved')))) then p.slug else null end as slug,
        case when p.status = 'published' and c.status = 'approved' then c.id else null end as "commentId"
      from public.community_notifications n join public.community_publications p on p.id = n.publication_id
      left join public.community_comments c on c.id = n.comment_id
      where n.recipient_uid = p_actor_uid and not exists(select 1 from public.community_blocks b where
        (b.actor_uid = p_actor_uid and b.blocked_uid = n.source_actor_uid) or (b.blocked_uid = p_actor_uid and b.actor_uid = n.source_actor_uid))
      order by n.created_at desc,n.id desc offset p_offset limit 50
    ) x;
  elsif p_scope = 'blocks' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (
      select id,display_name as "displayName",created_at as "createdAt" from public.community_blocks where actor_uid = p_actor_uid
        order by created_at desc,id offset p_offset limit 50) x;
  elsif p_scope = 'owned' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (
      select w.id as "workId",p.title,p.slug,w.kind from public.community_works w join public.community_publications p on p.id = w.current_publication_id
      where w.owner_uid = p_actor_uid and p.status = 'published' order by w.created_at desc,w.id offset p_offset limit 50) x;
  elsif p_scope = 'assignments' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (select sw.submission_id as "submissionId",sw.work_id as "workId"
      from public.community_submission_works sw join public.community_submissions s on s.id=sw.submission_id
      where s.owner_uid=p_actor_uid order by s.created_at desc,s.id offset p_offset limit 50) x;
  else return jsonb_build_object('error','invalid_scope');
  end if;
  return jsonb_build_object('items',items);
end $$;

-- Social state belongs to a stable community work. Publications remain immutable
-- reviewed snapshots; existing unrelated submissions are NEVER merged by title.
create table public.community_works (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('novel', 'book-analysis')),
  current_publication_id uuid references public.community_publications(id),
  created_at timestamptz not null default now()
);
create table public.community_submission_works (
  submission_id uuid primary key references public.community_submissions(id),
  work_id uuid not null references public.community_works(id),
  chosen_by uuid not null references auth.users(id),
  chosen_at timestamptz not null default now()
);
alter table public.community_publications add column community_work_id uuid references public.community_works(id);
alter table public.community_publications add column is_current boolean not null default true;
insert into public.community_works(id, owner_uid, kind, current_publication_id)
  select p.id, s.owner_uid, p.kind, p.id from public.community_publications p
  left join public.community_submissions s on s.id = p.submission_id;
update public.community_publications set community_work_id = id;
create index community_publication_work on public.community_publications(community_work_id);

create table public.community_likes (
  actor_uid uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.community_works(id),
  created_at timestamptz not null default now(), primary key(actor_uid, work_id)
);
create index community_likes_work on public.community_likes(work_id);
create table public.community_bookshelf (
  actor_uid uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.community_works(id),
  following boolean not null default true,
  created_at timestamptz not null default now(), primary key(actor_uid, work_id)
);
create index community_bookshelf_work on public.community_bookshelf(work_id) where following;
create table public.community_reading_progress (
  actor_uid uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.community_works(id),
  publication_id uuid not null references public.community_publications(id),
  section_index integer not null check(section_index between 0 and 10000000),
  entry_index integer not null check(entry_index between 0 and 10000000),
  block_index integer not null check(block_index between 0 and 10000000),
  updated_at timestamptz not null default now(), primary key(actor_uid, work_id)
);
create table public.community_blocks (
  actor_uid uuid not null references auth.users(id) on delete cascade,
  blocked_uid uuid not null references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  display_name text not null default '已屏蔽读者' check(char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(), primary key(actor_uid, blocked_uid),
  check(actor_uid <> blocked_uid)
);
create index community_blocks_target on public.community_blocks(blocked_uid, actor_uid);

create table public.community_flower_wallets (
  actor_uid uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check(balance between 0 and 30)
);
-- This ledger is append only. Its opaque account key has no public grant and
-- intentionally survives account deletion for reconciliation; it contains no PII.
create table public.community_flower_ledger (
  id uuid primary key default gen_random_uuid(), actor_uid uuid not null,
  idempotency_key uuid not null, kind text not null check(kind in ('claim','gift')),
  amount integer not null, balance_after integer not null check(balance_after between 0 and 30),
  claim_day date, work_id uuid references public.community_works(id),
  created_at timestamptz not null default now(), unique(actor_uid, idempotency_key),
  check ((kind = 'claim' and amount = 3 and claim_day is not null and work_id is null)
    or (kind = 'gift' and amount between -3 and -1 and claim_day is null and work_id is not null))
);
create unique index community_flower_daily_claim on public.community_flower_ledger(actor_uid, claim_day) where kind = 'claim';
create index community_flower_work on public.community_flower_ledger(work_id) where kind = 'gift';
create index community_flower_history on public.community_flower_ledger(actor_uid, created_at desc, id desc);

create table public.community_notifications (
  id uuid primary key default gen_random_uuid(), recipient_uid uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('update','comment','reply','flowers')),
  publication_id uuid not null references public.community_publications(id),
  comment_id uuid references public.community_comments(id),
  source_actor_uid uuid references auth.users(id) on delete set null,
  event_key text not null, quantity integer not null default 1 check(quantity > 0),
  read_at timestamptz, created_at timestamptz not null default now(),
  unique(recipient_uid, event_key)
);
create index community_notification_inbox on public.community_notifications(recipient_uid, created_at desc, id desc);

do $$ declare t text; begin
  foreach t in array array['community_works','community_submission_works','community_likes',
    'community_bookshelf','community_reading_progress','community_blocks',
    'community_flower_wallets','community_flower_ledger','community_notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
  end loop;
end $$;

create function public.community_publication_identity() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare w public.community_works%rowtype; s public.community_submissions%rowtype;
begin
  if TG_OP = 'UPDATE' then
    if new.community_work_id is distinct from old.community_work_id or
      new.approved_revision_sha256 <> old.approved_revision_sha256 or new.object_path <> old.object_path or
      new.submission_id is distinct from old.submission_id or new.toc <> old.toc then
      raise exception 'immutable_publication';
    end if;
    return new;
  end if;
  select * into s from public.community_submissions where id = new.submission_id;
  select w0.* into w from public.community_works w0 join public.community_submission_works sw on sw.work_id = w0.id
    where sw.submission_id = new.submission_id for update of w0;
  if found then
    if w.owner_uid is distinct from s.owner_uid or w.kind <> new.kind then raise exception 'work_owner_mismatch'; end if;
    if not exists(select 1 from public.community_publications where id = w.current_publication_id and status = 'published') then
      raise exception 'work_not_available';
    end if;
  else
    insert into public.community_works(owner_uid,kind) values(s.owner_uid,new.kind) returning * into w;
  end if;
  new.community_work_id := w.id;
  update public.community_publications set is_current = false where community_work_id = w.id and is_current;
  new.is_current := true;
  return new;
end $$;
create trigger community_publication_identity before insert or update on public.community_publications
  for each row execute function public.community_publication_identity();
create function public.community_publication_followers() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update public.community_works set current_publication_id = new.id where id = new.community_work_id;
  insert into public.community_notifications(recipient_uid,kind,publication_id,event_key,source_actor_uid)
    select b.actor_uid,'update',new.id,'update:' || new.id::text,w.owner_uid
    from public.community_bookshelf b join public.community_works w on w.id = b.work_id
    where b.work_id = new.community_work_id and b.following and b.actor_uid is distinct from w.owner_uid
      and not exists(select 1 from public.community_blocks x where
        (x.actor_uid = b.actor_uid and x.blocked_uid = w.owner_uid) or (x.blocked_uid = b.actor_uid and x.actor_uid = w.owner_uid))
    on conflict do nothing;
  return new;
end $$;
create trigger community_publication_followers after insert on public.community_publications
  for each row execute function public.community_publication_followers();

-- Assign an unreviewed submission to an existing work only on explicit author action.
create function public.community_choose_work(p_actor_uid uuid, p_submission_id uuid, p_work_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.community_submissions%rowtype; w public.community_works%rowtype;
begin
  select * into s from public.community_submissions where id = p_submission_id and owner_uid = p_actor_uid for update;
  if not found then return jsonb_build_object('error','submission_not_found'); end if;
  if s.status <> 'submitted' then return jsonb_build_object('error','review_already_started'); end if;
  if p_work_id is null then
    delete from public.community_submission_works where submission_id = s.id;
  else
    select * into w from public.community_works where id = p_work_id and owner_uid = p_actor_uid for update;
    if not found or w.kind <> s.kind or not exists(select 1 from public.community_publications where id = w.current_publication_id and status = 'published') then
      return jsonb_build_object('error','work_not_available');
    end if;
    if exists(select 1 from public.community_submission_works sw join public.community_submissions other on other.id = sw.submission_id
      where sw.work_id = w.id and other.id <> s.id and other.status in ('submitted','human_review','approved')) then
      return jsonb_build_object('error','revision_pending');
    end if;
    insert into public.community_submission_works(submission_id,work_id,chosen_by) values(s.id,w.id,p_actor_uid)
      on conflict(submission_id) do update set work_id = excluded.work_id,chosen_at = now();
  end if;
  return jsonb_build_object('ok',true);
end $$;

create function public.community_social_state(p_slug text, p_actor_uid uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.community_publications%rowtype; w public.community_works%rowtype;
begin
  select * into p from public.community_publications where slug = p_slug and status = 'published';
  if not found then return jsonb_build_object('error','work_not_available'); end if;
  select * into w from public.community_works where id = p.community_work_id;
  return jsonb_build_object('workId',w.id,'revisionId',p.id,'revisionHash',p.approved_revision_sha256,
    'currentSlug',(select slug from public.community_publications where id = w.current_publication_id and status = 'published'),
    'isAuthor',coalesce(w.owner_uid = p_actor_uid,false),
    'likes',(select count(*) from public.community_likes where work_id = w.id),
    'flowers',(select coalesce(-sum(amount),0) from public.community_flower_ledger where work_id = w.id and kind = 'gift'),
    'liked',exists(select 1 from public.community_likes where work_id = w.id and actor_uid = p_actor_uid),
    'saved',exists(select 1 from public.community_bookshelf where work_id = w.id and actor_uid = p_actor_uid),
    'following',coalesce((select following from public.community_bookshelf where work_id = w.id and actor_uid = p_actor_uid),false));
end $$;

create function public.community_social_action(p_actor_uid uuid, p_action text, p_slug text default null,
  p_value boolean default null, p_key uuid default null, p_amount integer default null, p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.community_publications%rowtype; w public.community_works%rowtype;
  old public.community_flower_ledger%rowtype; bal integer; target uuid; rid uuid;
  today date := (now() at time zone 'Asia/Shanghai')::date;
begin
  if p_actor_uid is null or not exists(select 1 from auth.users where id = p_actor_uid) then
    return jsonb_build_object('error','authentication_required');
  end if;
  -- Serialize all mutations by account, including cross-work gifts and daily claims.
  perform pg_advisory_xact_lock(hashtextextended(p_actor_uid::text,0));
  if p_action in ('claim','gift') then
    if p_key is null or (p_action = 'gift' and (p_amount is null or p_amount not between 1 and 3)) then
      return jsonb_build_object('error','invalid_action');
    end if;
    select * into old from public.community_flower_ledger where actor_uid = p_actor_uid and idempotency_key = p_key;
    if found then
      if old.kind <> p_action or (p_action = 'gift' and (old.amount <> -p_amount or not exists(
        select 1 from public.community_publications where slug = p_slug and community_work_id = old.work_id))) then
        return jsonb_build_object('error','idempotency_conflict');
      end if;
      return jsonb_build_object('ok',true,'receiptId',old.id,'balanceAfter',old.balance_after,'replayed',true);
    end if;
  end if;
  if p_action in ('like','save','follow','gift','progress') then
    select * into p from public.community_publications where slug = p_slug and status = 'published' for share;
    if not found then return jsonb_build_object('error','work_not_available'); end if;
    select * into w from public.community_works where id = p.community_work_id;
    if not exists(select 1 from public.community_publications where id = w.current_publication_id and status = 'published') then
      return jsonb_build_object('error','work_not_available');
    end if;
  end if;
  if p_action in ('like','save','follow') then
    if p_value is null then return jsonb_build_object('error','invalid_action'); end if;
    if p_action = 'like' then
      if p_value then insert into public.community_likes(actor_uid,work_id) values(p_actor_uid,w.id) on conflict do nothing;
      else delete from public.community_likes where actor_uid = p_actor_uid and work_id = w.id; end if;
    elsif p_action = 'save' then
      if p_value then insert into public.community_bookshelf(actor_uid,work_id) values(p_actor_uid,w.id) on conflict do nothing;
      else delete from public.community_bookshelf where actor_uid = p_actor_uid and work_id = w.id; end if;
    else
      insert into public.community_bookshelf(actor_uid,work_id,following) values(p_actor_uid,w.id,p_value)
        on conflict(actor_uid,work_id) do update set following = excluded.following;
    end if;
  elsif p_action in ('claim','gift') then
    insert into public.community_flower_wallets(actor_uid) values(p_actor_uid) on conflict do nothing;
    select balance into bal from public.community_flower_wallets where actor_uid = p_actor_uid for update;
    if p_action = 'claim' then
      if exists(select 1 from public.community_flower_ledger where actor_uid = p_actor_uid and claim_day = today) then
        return jsonb_build_object('error','already_claimed');
      end if;
      if bal > 27 then return jsonb_build_object('error','wallet_full'); end if;
      bal := bal + 3;
      insert into public.community_flower_ledger(actor_uid,idempotency_key,kind,amount,balance_after,claim_day)
        values(p_actor_uid,p_key,'claim',3,bal,today) returning id into rid;
    else
      if w.owner_uid = p_actor_uid then return jsonb_build_object('error','self_gift_forbidden'); end if;
      if exists(select 1 from public.community_blocks where (actor_uid = p_actor_uid and blocked_uid = w.owner_uid)
        or (blocked_uid = p_actor_uid and actor_uid = w.owner_uid)) then return jsonb_build_object('error','interaction_unavailable'); end if;
      if bal < p_amount then return jsonb_build_object('error','insufficient_flowers'); end if;
      bal := bal - p_amount;
      insert into public.community_flower_ledger(actor_uid,idempotency_key,kind,amount,balance_after,work_id)
        values(p_actor_uid,p_key,'gift',-p_amount,bal,w.id) returning id into rid;
      if w.owner_uid is not null then
        insert into public.community_notifications(recipient_uid,kind,publication_id,event_key,quantity)
          values(w.owner_uid,'flowers',w.current_publication_id,'flowers:'||w.id::text||':'||today::text,p_amount)
          on conflict(recipient_uid,event_key) do update set quantity = community_notifications.quantity + excluded.quantity,
            read_at = null,created_at = now(),publication_id = excluded.publication_id;
      end if;
    end if;
    update public.community_flower_wallets set balance = bal where actor_uid = p_actor_uid;
    return jsonb_build_object('ok',true,'receiptId',rid,'balanceAfter',bal);
  elsif p_action = 'progress' then
    if p_data->>'revisionId' is distinct from p.id::text or jsonb_typeof(p_data->'section') <> 'number' or
      jsonb_typeof(p_data->'entry') <> 'number' or jsonb_typeof(p_data->'block') <> 'number' then
      return jsonb_build_object('error','invalid_progress');
    end if;
    insert into public.community_reading_progress(actor_uid,work_id,publication_id,section_index,entry_index,block_index)
      values(p_actor_uid,w.id,p.id,(p_data->>'section')::integer,(p_data->>'entry')::integer,(p_data->>'block')::integer)
      on conflict(actor_uid,work_id) do update set publication_id = excluded.publication_id,section_index = excluded.section_index,
        entry_index = excluded.entry_index,block_index = excluded.block_index,updated_at = now();
  elsif p_action = 'block' then
    select c.author_uid into target from public.community_comments c join public.community_publications pub on pub.id = c.publication_id
      where c.id = (p_data->>'commentId')::uuid and c.status = 'approved' and pub.status = 'published';
    if target is null or target = p_actor_uid then return jsonb_build_object('error','interaction_unavailable'); end if;
    insert into public.community_blocks(actor_uid,blocked_uid,display_name) select p_actor_uid,target,display_name
      from public.community_comments where id = (p_data->>'commentId')::uuid on conflict do nothing;
  elsif p_action = 'unsave' then
    delete from public.community_bookshelf where actor_uid=p_actor_uid and work_id=(p_data->>'workId')::uuid;
  elsif p_action = 'unblock' then
    delete from public.community_blocks where actor_uid = p_actor_uid and id = (p_data->>'blockId')::uuid;
  elsif p_action = 'read-notification' then
    update public.community_notifications set read_at = coalesce(read_at,now()) where recipient_uid = p_actor_uid and id = (p_data->>'notificationId')::uuid;
  else return jsonb_build_object('error','invalid_action');
  end if;
  return jsonb_build_object('ok',true);
end $$;

create function public.community_social_private(p_actor_uid uuid,p_scope text,p_offset integer default 0)
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
        case when p.status = 'published' and (n.comment_id is null or c.status = 'approved') then p.title else '内容暂不可访问' end as title,
        case when p.status = 'published' and (n.comment_id is null or c.status = 'approved') then p.slug else null end as slug,
        case when p.status = 'published' and c.status = 'approved' then c.id else null end as "commentId"
      from public.community_notifications n join public.community_publications p on p.id = n.publication_id
      left join public.community_comments c on c.id = n.comment_id
      where n.recipient_uid = p_actor_uid and not exists(select 1 from public.community_blocks b where
        (b.actor_uid = p_actor_uid and b.blocked_uid = n.source_actor_uid) or (b.blocked_uid = p_actor_uid and b.actor_uid = n.source_actor_uid))
      order by n.created_at desc,n.id desc offset p_offset limit 50
    ) x;
  elsif p_scope = 'blocks' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (
      select id,created_at as "createdAt" from public.community_blocks where actor_uid = p_actor_uid
        order by created_at desc,id offset p_offset limit 50) x;
  elsif p_scope = 'owned' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (
      select w.id as "workId",p.title,p.slug,w.kind from public.community_works w join public.community_publications p on p.id = w.current_publication_id
      where w.owner_uid = p_actor_uid and p.status = 'published' order by w.created_at desc,w.id offset p_offset limit 50) x;
  else return jsonb_build_object('error','invalid_scope');
  end if;
  return jsonb_build_object('items',items);
end $$;

-- No raw ownership identifiers, balances, subscriptions, or private activity are
-- exposed through the Data API. The BFF supplies only a verified Auth user id.
revoke all on function public.community_publication_identity(), public.community_publication_followers() from public,anon,authenticated,service_role;
revoke all on function public.community_choose_work(uuid,uuid,uuid),public.community_social_state(text,uuid),
  public.community_social_action(uuid,text,text,boolean,uuid,integer,jsonb),public.community_social_private(uuid,text,integer)
  from public,anon,authenticated;
grant execute on function public.community_choose_work(uuid,uuid,uuid),public.community_social_state(text,uuid),
  public.community_social_action(uuid,text,text,boolean,uuid,integer,jsonb),public.community_social_private(uuid,text,integer) to service_role;

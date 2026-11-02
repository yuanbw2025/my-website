-- Dedicated community classification lifecycle; no local Work/AI adoption writes.
-- Model attempts cannot impersonate a human reviewer, retry an unknown call, or
-- publish an incomplete/different revision. Defaults are deliberately disabled.
create table public.community_automod_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  auto_publish boolean not null default false,
  daily_call_limit integer not null default 200 check(daily_call_limit between 1 and 2000),
  budget_day date not null default current_date, calls_reserved integer not null default 0,
  lease uuid, lease_until timestamptz
);
insert into public.community_automod_settings(singleton) values(true);
create table public.community_automod_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid unique references public.community_submissions(id) on delete cascade,
  comment_id uuid unique references public.community_comments(id) on delete cascade,
  revision_sha256 text not null check(revision_sha256 ~ '^[a-f0-9]{64}$'),
  policy_version text not null default 'community-safety-20261102-v1' check(policy_version='community-safety-20261102-v1'),
  model text not null default 'agnes-2.5-flash' check(model='agnes-2.5-flash'),
  state text not null default 'queued' check(state in ('queued','processing','needs_review','clear','published','stale')),
  reason_code text, manifest_sha256 text, unit_hashes jsonb, public_projection jsonb,
  next_unit integer not null default 0 check(next_unit between 0 and 96),
  lease uuid, lease_until timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((submission_id is null) <> (comment_id is null)),
  check(unit_hashes is null or (jsonb_typeof(unit_hashes)='array' and jsonb_array_length(unit_hashes) between 2 and 96 and jsonb_array_length(unit_hashes)%2=0))
);
create index community_automod_queue on public.community_automod_jobs(created_at,id) where state in ('queued','clear');
create table public.community_automod_attempts (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.community_automod_jobs(id),
  unit_index integer not null, input_sha256 text not null check(input_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'running' check(status in ('running','clear','escalate','unknown')),
  categories jsonb not null default '[]', response_sha256 text, reason_code text,
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique(job_id,unit_index)
);
create table public.community_moderator_alerts (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.community_automod_jobs(id),
  recipient_uid uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), resolved_at timestamptz, unique(job_id,recipient_uid)
);
do $$ declare t text; begin
 foreach t in array array['community_automod_settings','community_automod_jobs','community_automod_attempts','community_moderator_alerts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

alter table public.community_moderation_events alter column actor_uid drop not null;
alter table public.community_moderation_events add column actor_type text not null default 'human' check(actor_type in ('human','model'));
alter table public.community_moderation_events add column automation_job_id uuid references public.community_automod_jobs(id);
alter table public.community_moderation_events add constraint moderation_actor_identity check(
 (actor_type='human' and actor_uid is not null and automation_job_id is null) or
 (actor_type='model' and actor_uid is null and automation_job_id is not null));
alter table public.community_comment_events alter column actor_uid drop not null;
alter table public.community_comment_events add column actor_type text not null default 'human' check(actor_type in ('human','model'));
alter table public.community_comment_events add column automation_job_id uuid references public.community_automod_jobs(id);
alter table public.community_comment_events add constraint comment_actor_identity check(
 (actor_type='human' and actor_uid is not null and automation_job_id is null) or
 (actor_type='model' and actor_uid is null and automation_job_id is not null));

create function public.community_comment_revision(c public.community_comments) returns text language sql immutable
set search_path=public,pg_temp as $$ select encode(sha256(convert_to(jsonb_build_array(c.publication_id,c.display_name,c.body,c.anchor,c.parent_id)::text,'UTF8')),'hex') $$;

create function public.community_enqueue_moderation() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_TABLE_NAME='community_submissions' then
  insert into public.community_automod_jobs(submission_id,revision_sha256) values(new.id,new.sha256) on conflict do nothing;
 else
  insert into public.community_automod_jobs(comment_id,revision_sha256) values(new.id,public.community_comment_revision(new)) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger community_submission_automod after insert on public.community_submissions for each row execute function public.community_enqueue_moderation();
create trigger community_comment_automod after insert on public.community_comments for each row execute function public.community_enqueue_moderation();
insert into public.community_automod_jobs(submission_id,revision_sha256) select id,sha256 from public.community_submissions where status='submitted';
insert into public.community_automod_jobs(comment_id,revision_sha256) select id,public.community_comment_revision(c) from public.community_comments c where status='pending';

create function public.community_automod_alert(p_job uuid,p_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- A manual decision/withdrawal may finish while the external request is away.
 if not exists(select 1 from public.community_automod_jobs j
  left join public.community_submissions s on s.id=j.submission_id
  left join public.community_comments c on c.id=j.comment_id
  where j.id=p_job and (s.status in ('submitted','human_review') or c.status='pending')) then
  update public.community_automod_jobs set state='stale',lease=null,lease_until=null,updated_at=now() where id=p_job;
  return;
 end if;
 update public.community_automod_jobs set state='needs_review',reason_code=p_reason,lease=null,lease_until=null,updated_at=now() where id=p_job;
 insert into public.community_moderator_alerts(job_id,recipient_uid)
  select p_job,uid from public.community_reviewers where active on conflict do nothing;
end $$;
create function public.community_automod_resolve() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status<>old.status and new.status not in ('submitted','human_review','pending') then
  update public.community_moderator_alerts a set resolved_at=now() from public.community_automod_jobs j
   where a.job_id=j.id and a.resolved_at is null and
    ((TG_TABLE_NAME='community_submissions' and j.submission_id=new.id) or (TG_TABLE_NAME='community_comments' and j.comment_id=new.id));
  update public.community_automod_jobs j set state='stale',updated_at=now()
   where j.state in ('queued','needs_review','clear') and
    ((TG_TABLE_NAME='community_submissions' and j.submission_id=new.id) or (TG_TABLE_NAME='community_comments' and j.comment_id=new.id));
 end if; return new;
end $$;
create trigger community_submission_alert_resolve after update of status on public.community_submissions for each row execute function public.community_automod_resolve();
create trigger community_comment_alert_resolve after update of status on public.community_comments for each row execute function public.community_automod_resolve();

-- One global in-flight lease. Expired attempts become manual work, never re-sent.
create function public.community_automod_claim() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg public.community_automod_settings%rowtype; j public.community_automod_jobs%rowtype; expired record; token uuid;
begin
 select * into cfg from public.community_automod_settings where singleton for update;
 if not cfg.enabled then return jsonb_build_object('idle',true,'reason','disabled'); end if;
 if cfg.lease_until>now() then return jsonb_build_object('idle',true,'reason','busy'); end if;
 for expired in select id from public.community_automod_jobs where state='processing' and lease_until<=now() for update loop
  update public.community_automod_attempts set status='unknown',reason_code='worker_interrupted',completed_at=now() where job_id=expired.id and status='running';
  perform public.community_automod_alert(expired.id,'worker_interrupted');
 end loop;
 update public.community_automod_jobs j0 set state='stale',updated_at=now() where state in ('queued','clear') and
  ((submission_id is not null and not exists(select 1 from public.community_submissions s where s.id=j0.submission_id and s.status='submitted' and s.sha256=j0.revision_sha256)) or
   (comment_id is not null and not exists(select 1 from public.community_comments c where c.id=j0.comment_id and c.status='pending' and public.community_comment_revision(c)=j0.revision_sha256)));
 select * into j from public.community_automod_jobs where state='queued' or (state='clear' and cfg.auto_publish) order by created_at,id limit 1 for update;
 if not found then return jsonb_build_object('idle',true,'reason','empty'); end if;
 token:=gen_random_uuid();
 update public.community_automod_settings set lease=token,lease_until=now()+interval '120 seconds' where singleton;
 update public.community_automod_jobs set state='processing',lease=token,lease_until=now()+interval '120 seconds',updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;

create function public.community_automod_payload(p_job uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.community_automod_jobs%rowtype; result jsonb;
begin
 select * into j from public.community_automod_jobs where id=p_job and lease=p_lease and lease_until>now() and state='processing';
 if not found then raise exception 'invalid_lease'; end if;
 if j.submission_id is not null then
  select jsonb_build_object('submission',jsonb_build_object('id',s.id,'owner_uid',s.owner_uid,'object_path',s.object_path,'sha256',s.sha256,'byte_length',s.byte_length,'kind',s.kind,'publicPenName',s.public_pen_name)) into result
   from public.community_submissions s where s.id=j.submission_id and s.status='submitted' and s.sha256=j.revision_sha256;
 else
  select jsonb_build_object('comment',jsonb_build_object('displayName',c.display_name,'body',c.body,'anchor',c.anchor,'parentBody',parent.body,'publicationTitle',p.title)) into result
   from public.community_comments c join public.community_publications p on p.id=c.publication_id left join public.community_comments parent on parent.id=c.parent_id
   where c.id=j.comment_id and c.status='pending' and public.community_comment_revision(c)=j.revision_sha256 and p.status='published' and (c.parent_id is null or parent.status='approved');
 end if;
 return result;
end $$;

create function public.community_automod_plan(p_job uuid,p_lease uuid,p_manifest text,p_hashes jsonb,p_projection jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.community_automod_jobs%rowtype;
begin
 select * into j from public.community_automod_jobs where id=p_job and lease=p_lease and lease_until>now() and state='processing' for update;
 if not found then raise exception 'invalid_lease'; end if;
 if p_manifest is null or p_manifest!~'^[a-f0-9]{64}$' or p_hashes is null or jsonb_typeof(p_hashes)<>'array' or jsonb_array_length(p_hashes) not between 2 and 96 or jsonb_array_length(p_hashes)%2<>0 or
  exists(select 1 from jsonb_array_elements(p_hashes) v where jsonb_typeof(v)<>'string' or v#>>'{}' !~'^[a-f0-9]{64}$') then raise exception 'invalid_coverage'; end if;
 if j.manifest_sha256 is not null and (j.manifest_sha256<>p_manifest or j.unit_hashes<>p_hashes or j.public_projection is distinct from p_projection) then raise exception 'coverage_changed'; end if;
 update public.community_automod_jobs set manifest_sha256=p_manifest,unit_hashes=p_hashes,public_projection=p_projection where id=j.id;
end $$;

create function public.community_automod_begin(p_job uuid,p_lease uuid,p_index integer,p_hash text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg public.community_automod_settings%rowtype; j public.community_automod_jobs%rowtype; attempt uuid;
begin
 select * into cfg from public.community_automod_settings where singleton for update;
 select * into j from public.community_automod_jobs where id=p_job and lease=p_lease and lease_until>now() and state='processing' for update;
 if not found or cfg.lease is distinct from p_lease then raise exception 'invalid_lease'; end if;
 if not cfg.enabled then raise exception 'automation_disabled'; end if;
 if p_index is null or p_hash is null or j.unit_hashes is null or p_index<>j.next_unit or (j.unit_hashes->>p_index) is distinct from p_hash then raise exception 'invalid_unit'; end if;
 if cfg.budget_day<>(now() at time zone 'UTC')::date then
  update public.community_automod_settings set budget_day=(now() at time zone 'UTC')::date,calls_reserved=0 where singleton;cfg.calls_reserved:=0;
 end if;
 if cfg.calls_reserved>=cfg.daily_call_limit then
  perform public.community_automod_alert(j.id,'daily_model_budget');
  update public.community_automod_settings set lease=null,lease_until=null where singleton;
  return jsonb_build_object('allowed',false);
 end if;
 insert into public.community_automod_attempts(job_id,unit_index,input_sha256) values(j.id,p_index,p_hash) returning id into attempt;
 update public.community_automod_settings set calls_reserved=calls_reserved+1 where singleton;
 return jsonb_build_object('allowed',true,'attemptId',attempt);
end $$;

create function public.community_automod_finish(p_job uuid,p_lease uuid,p_index integer,p_decision text,p_categories jsonb,p_response_hash text,p_reason text default null)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg public.community_automod_settings%rowtype; j public.community_automod_jobs%rowtype; next_state text;
begin
 select * into cfg from public.community_automod_settings where singleton for update;
 select * into j from public.community_automod_jobs where id=p_job and lease=p_lease and lease_until>now() and state='processing' for update;
 if not found or cfg.lease is distinct from p_lease then raise exception 'invalid_lease'; end if;
 if p_decision is null or p_decision not in ('clear','escalate','unknown') or p_categories is null or jsonb_typeof(p_categories)<>'array' or
  jsonb_array_length(p_categories)>12 or exists(select 1 from jsonb_array_elements_text(p_categories) c where c not in ('child_safety','explicit_sexual','sexual_violence','graphic_harm','threats','hate','privacy','harassment','illegal_trade','copyright','manipulation','uncertain')) or
  (p_decision='clear' and (p_categories<>'[]'::jsonb or p_response_hash is null or p_response_hash!~'^[a-f0-9]{64}$' or p_reason is not null)) or
  (p_reason is not null and p_reason!~'^[a-z_]{1,50}$') then raise exception 'invalid_verdict'; end if;
 if p_index is null or p_index<>j.next_unit then raise exception 'invalid_unit'; end if;
 update public.community_automod_attempts set status=p_decision,categories=p_categories,response_sha256=p_response_hash,reason_code=p_reason,completed_at=now()
  where job_id=j.id and unit_index=p_index and status='running';
 if not found then raise exception 'attempt_not_running'; end if;
 if p_decision='clear' then
  next_state:=case when j.next_unit+1=jsonb_array_length(j.unit_hashes) then 'clear' else 'queued' end;
  update public.community_automod_jobs set state=next_state,next_unit=next_unit+1,lease=null,lease_until=null,updated_at=now() where id=j.id;
 else
  perform public.community_automod_alert(j.id,coalesce(p_reason,'model_needs_review')); next_state:='needs_review';
 end if;
 update public.community_automod_settings set lease=null,lease_until=null where singleton;
 return next_state;
end $$;

-- Pre-model failures have no attempt and are escalated without leaking raw errors.
create function public.community_automod_fail(p_job uuid,p_lease uuid,p_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.community_automod_settings where singleton and lease=p_lease for update;
 if not found then raise exception 'invalid_lease'; end if;
 perform 1 from public.community_automod_jobs where id=p_job and lease=p_lease and state='processing' for update;
 if not found or p_reason is null or p_reason!~'^[a-z_]{1,50}$' then raise exception 'invalid_failure'; end if;
 update public.community_automod_attempts set status='unknown',reason_code=p_reason,completed_at=now() where job_id=p_job and status='running';
 perform public.community_automod_alert(p_job,p_reason);
 if p_reason in ('model_auth_failed','model_rate_limited','model_config') then
  update public.community_automod_settings set enabled=false where singleton;
 end if;
 update public.community_automod_settings set lease=null,lease_until=null where singleton;
end $$;

create function public.community_automod_inbox(p_actor uuid,p_badge boolean default false) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare items jsonb; total integer;
begin
 if not exists(select 1 from public.community_reviewers where uid=p_actor and active) then return jsonb_build_object('reviewer',false); end if;
 select count(*)::integer into total from public.community_moderator_alerts where recipient_uid=p_actor and resolved_at is null;
 if p_badge then return jsonb_build_object('reviewer',true,'pending',total); end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into items from (
  select j.id,j.submission_id as "submissionId",j.comment_id as "commentId",j.state,j.reason_code as "reasonCode",j.policy_version as "policyVersion",j.model,j.next_unit as "completedUnits",
   coalesce(jsonb_array_length(j.unit_hashes),0) as "totalUnits",j.updated_at as "updatedAt",
   (select coalesce(jsonb_agg(distinct cat),'[]') from public.community_automod_attempts t cross join lateral jsonb_array_elements_text(t.categories) cat where t.job_id=j.id) as categories
  from public.community_automod_jobs j where j.state<>'stale' order by (j.state='needs_review') desc,j.updated_at desc limit 50
 ) x;
 return jsonb_build_object('reviewer',true,'pending',total,'items',items,'enabled',(select enabled from public.community_automod_settings where singleton),
  'autoPublish',(select auto_publish from public.community_automod_settings where singleton),'callsToday',(select case when budget_day=(now() at time zone 'UTC')::date then calls_reserved else 0 end from public.community_automod_settings where singleton),
  'dailyLimit',(select daily_call_limit from public.community_automod_settings where singleton));
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and (p.proname like 'community_automod_%' or p.proname in ('community_comment_revision','community_enqueue_moderation')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
grant execute on function public.community_automod_claim(),public.community_automod_payload(uuid,uuid),public.community_automod_plan(uuid,uuid,text,jsonb,jsonb),
 public.community_automod_begin(uuid,uuid,integer,text),public.community_automod_finish(uuid,uuid,integer,text,jsonb,text,text),
 public.community_automod_fail(uuid,uuid,text),public.community_automod_inbox(uuid,boolean) to service_role;

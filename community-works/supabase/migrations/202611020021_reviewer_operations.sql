-- One read-only source for both upload admission and reviewer capacity display.
-- No Storage metadata writes, retention changes, author data changes or new tables.
create function public.community_storage_capacity_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  reserved_bytes numeric;
  observed_bytes numeric;
  unknown_sizes bigint;
  bucket_safe boolean;
begin
  select exists (select 1 from storage.buckets where id = 'community-intake'
    and public = false and file_size_limit = 33554432) into bucket_safe;
  select count(*) into unknown_sizes from storage.objects where bucket_id = 'community-intake'
    and (metadata->>'size' is null or (metadata->>'size') !~ '^[0-9]{1,20}$');
  select coalesce(sum(case when (metadata->>'size') ~ '^[0-9]{1,20}$'
    then (metadata->>'size')::numeric else 0 end), 0) into observed_bytes
    from storage.objects where bucket_id = 'community-intake';
  with objects as (
    select name, (metadata->>'size')::numeric as bytes
      from storage.objects where bucket_id = 'community-intake' and (metadata->>'size') ~ '^[0-9]{1,20}$'
  ), accounted as (
    select case
      when s.status = 'verified' and o.name is not null
        then greatest(s.byte_length::numeric, o.bytes)
      else greatest(33554432::numeric, coalesce(o.bytes, 0))
      end as bytes
    from public.community_upload_sessions s
    left join objects o on o.name = s.object_path
    where s.purged_at is null
    union all
    select o.bytes from objects o where not exists (
      select 1 from public.community_upload_sessions s
        where s.object_path = o.name and s.purged_at is null
    )
  ) select coalesce(pg_catalog.sum(bytes), 0) into reserved_bytes from accounted;


  return jsonb_build_object(
    'valid', bucket_safe and unknown_sizes = 0,
    'bucketSafe', bucket_safe, 'unknownSizeObjects', unknown_sizes,
    'observedBytes', case when unknown_sizes = 0 then observed_bytes else null end,
    'reservedBytes', case when unknown_sizes = 0 then reserved_bytes else null end,
    'budgetBytes', 786432000, 'reservationBytes', 33554432,
    'canAllocate', bucket_safe and unknown_sizes = 0 and reserved_bytes + 33554432 <= 786432000,
    'objectCount', (select count(*) from storage.objects where bucket_id = 'community-intake'),
    'unboundObjects', (select count(*) from storage.objects o where bucket_id = 'community-intake'
      and not exists(select 1 from public.community_upload_sessions s where s.object_path = o.name and s.purged_at is null)),
    'missingVerifiedObjects', (select count(*) from public.community_upload_sessions s
      where status = 'verified' and purged_at is null and not exists(select 1 from storage.objects o
        where o.bucket_id = 'community-intake' and o.name = s.object_path)),
    'pendingSessions', (select count(*) from public.community_upload_sessions where status <> 'verified' and purged_at is null),
    'cleanupEligibleSessions', (select count(*) from public.community_upload_sessions s
      where status in ('created','failed','expired') and purged_at is null and created_at < now() - interval '48 hours'
        and not exists(select 1 from public.community_submissions p where p.upload_session_id = s.id))
  );
end;
$$;
revoke all on function public.community_storage_capacity_snapshot() from public, anon, authenticated;
grant execute on function public.community_storage_capacity_snapshot() to service_role;

create or replace function public.community_allocate_upload_session(
  p_owner_uid uuid, p_idempotency_key uuid, p_kind text,
  p_sha256 text, p_byte_length integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  existing public.community_upload_sessions%rowtype;
  new_id uuid;
  reserved_bytes numeric;
  is_resume boolean;
  capacity jsonb;
begin
  if p_owner_uid is null or p_idempotency_key is null or
     p_kind is null or p_kind not in ('novel', 'book-analysis') or
     p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or
     p_byte_length is null or p_byte_length not between 1 and 33554432 then
    return pg_catalog.jsonb_build_object('error', 'invalid_manifest');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(410434, 1);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_owner_uid::text));
  select * into existing from public.community_upload_sessions
    where owner_uid = p_owner_uid and idempotency_key = p_idempotency_key;
  is_resume := found;
  if is_resume then
    if existing.kind <> p_kind or existing.sha256 <> p_sha256 or
       existing.byte_length <> p_byte_length then
      return pg_catalog.jsonb_build_object('error', 'idempotency_conflict');
    end if;
    if existing.status <> 'created' or existing.expires_at <= pg_catalog.now() or
       existing.purged_at is not null then
      return pg_catalog.jsonb_build_object('error', 'upload_session_expired_or_used');
    end if;
  elsif (select count(*) from public.community_upload_sessions
      where owner_uid = p_owner_uid and created_at >= pg_catalog.now() - interval '24 hours') >= 10 then
    return pg_catalog.jsonb_build_object('error', 'daily_upload_limit');
  end if;

  capacity := public.community_storage_capacity_snapshot();
  if not (capacity->>'valid')::boolean then
    return pg_catalog.jsonb_build_object('error', 'storage_capacity_paused');
  end if;
  reserved_bytes := (capacity->>'reservedBytes')::numeric;

  -- A resume reuses its reservation; it may not renew a legacy over-allocation.
  if reserved_bytes + (case when is_resume then 0 else (capacity->>'reservationBytes')::numeric end)
      > (capacity->>'budgetBytes')::numeric then
    return pg_catalog.jsonb_build_object('error', 'storage_capacity_paused');
  end if;
  if not is_resume then
    new_id := pg_catalog.gen_random_uuid();
    insert into public.community_upload_sessions
      (id, owner_uid, idempotency_key, kind, object_path, sha256, byte_length, expires_at)
    values (new_id, p_owner_uid, p_idempotency_key, p_kind,
      p_owner_uid::text || '/' || new_id::text || '/snapshot.json',
      p_sha256, p_byte_length, pg_catalog.now() + interval '1 hour')
    returning * into existing;
  end if;
  return pg_catalog.jsonb_build_object('id', existing.id, 'owner_uid', existing.owner_uid,
    'kind', existing.kind, 'object_path', existing.object_path,
    'sha256', existing.sha256, 'byte_length', existing.byte_length,
    'status', existing.status, 'expires_at', existing.expires_at);
end;
$$;

revoke all on function public.community_allocate_upload_session(uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.community_allocate_upload_session(uuid, uuid, text, text, integer)
  to service_role;

-- The BFF additionally verifies Auth and AAL2 before calling this service-only RPC.
create function public.community_operations_snapshot(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.community_reviewers where uid = p_actor and active) then
    raise exception 'reviewer_required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'sampledAt', now(),
    'storage', public.community_storage_capacity_snapshot(),
    'queues', jsonb_build_object(
      'submissions', (select count(*) from public.community_submissions where status in ('submitted','human_review')),
      'comments', (select count(*) from public.community_comments where status = 'pending'),
      'reports', (select count(*) from public.community_reports where status in ('open','escalated')) +
        (select count(*) from public.community_comment_reports where status in ('open','escalated')),
      'urgentReports', (select count(*) from public.community_reports where status in ('open','escalated')
        and reason_code in ('child_safety','violence_threat','sexual_violence')) +
        (select count(*) from public.community_comment_reports where status in ('open','escalated')
        and reason_code in ('child_safety','violence_threat','sexual_violence')),
      'appeals', (select count(*) from public.community_appeals where status = 'open'),
      'oldestPendingAt', (select min(created_at) from (
        select created_at from public.community_submissions where status in ('submitted','human_review')
        union all select created_at from public.community_comments where status = 'pending'
        union all select created_at from public.community_reports where status in ('open','escalated')
        union all select created_at from public.community_comment_reports where status in ('open','escalated')
        union all select created_at from public.community_appeals where status = 'open'
      ) pending),
      'expiredModelLeases', (select count(*) from public.community_automod_jobs where state = 'processing'
        and (lease_until is null or lease_until <= now()))
    )
  );
end;
$$;
revoke all on function public.community_operations_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.community_operations_snapshot(uuid) to service_role;

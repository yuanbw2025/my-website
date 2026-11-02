-- Signed targets accept up to the bucket limit, regardless of the client manifest.
-- Reserve that limit until verification. Storage metadata is read-only here;
-- object creation/removal must continue through the Storage API.
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

  -- A changed bucket limit or unreadable size cannot be treated as zero usage.
  if not exists (select 1 from storage.buckets where id = 'community-intake'
      and public = false and file_size_limit = 33554432) or exists (
    select 1 from storage.objects where bucket_id = 'community-intake' and
      (metadata->>'size' is null or (metadata->>'size') !~ '^[0-9]{1,20}$')
  ) then
    return pg_catalog.jsonb_build_object('error', 'storage_capacity_paused');
  end if;

  with objects as (
    select name, (metadata->>'size')::numeric as bytes
      from storage.objects where bucket_id = 'community-intake'
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

  -- A resume reuses its reservation; it may not renew a legacy over-allocation.
  if reserved_bytes + (case when is_resume then 0 else 33554432 end) > 786432000 then
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

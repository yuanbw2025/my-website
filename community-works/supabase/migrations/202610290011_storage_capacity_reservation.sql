-- Apply the global free-tier reservation ceiling as well as the owner quota.
-- The global lock serializes allocations from different owners.
create or replace function public.community_allocate_upload_session(
  p_owner_uid uuid, p_idempotency_key uuid, p_kind text,
  p_sha256 text, p_byte_length integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  existing public.community_upload_sessions%rowtype;
  new_id uuid;
  reserved_bytes bigint;
begin
  if p_owner_uid is null or p_idempotency_key is null or
     p_kind not in ('novel', 'book-analysis') or
     p_sha256 !~ '^[0-9a-f]{64}$' or
     p_byte_length not between 1 and 33554432 then
    return pg_catalog.jsonb_build_object('error', 'invalid_manifest');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(410434, 1);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_owner_uid::text));
  select * into existing from public.community_upload_sessions
    where owner_uid = p_owner_uid and idempotency_key = p_idempotency_key;
  if found then
    if existing.kind <> p_kind or existing.sha256 <> p_sha256 or
       existing.byte_length <> p_byte_length then
      return pg_catalog.jsonb_build_object('error', 'idempotency_conflict');
    end if;
    if existing.status <> 'created' or existing.expires_at <= pg_catalog.now() then
      return pg_catalog.jsonb_build_object('error', 'upload_session_expired_or_used');
    end if;
    return pg_catalog.jsonb_build_object('id', existing.id, 'owner_uid', existing.owner_uid,
      'kind', existing.kind, 'object_path', existing.object_path,
      'sha256', existing.sha256, 'byte_length', existing.byte_length,
      'status', existing.status, 'expires_at', existing.expires_at);
  end if;
  if (select count(*) from public.community_upload_sessions
      where owner_uid = p_owner_uid and created_at >= pg_catalog.now() - interval '24 hours') >= 10 then
    return pg_catalog.jsonb_build_object('error', 'daily_upload_limit');
  end if;
  select coalesce(pg_catalog.sum(byte_length), 0) into reserved_bytes
    from public.community_upload_sessions where purged_at is null;
  if reserved_bytes + p_byte_length > 786432000 then
    return pg_catalog.jsonb_build_object('error', 'storage_capacity_paused');
  end if;
  new_id := pg_catalog.gen_random_uuid();
  insert into public.community_upload_sessions
    (id, owner_uid, idempotency_key, kind, object_path, sha256, byte_length, expires_at)
  values (new_id, p_owner_uid, p_idempotency_key, p_kind,
    p_owner_uid::text || '/' || new_id::text || '/snapshot.json',
    p_sha256, p_byte_length, pg_catalog.now() + interval '1 hour')
  returning * into existing;
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

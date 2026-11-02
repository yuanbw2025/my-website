-- Apply only to the dedicated community project after migrating and deploying.
-- Provision two Vault entries privately first: community_automod_url (the
-- auto-moderate HTTPS function URL) and community_automod_token (worker-only token).
-- No model credential or service-role key belongs in this scheduled command.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create or replace function public.community_automod_tick() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare target text; worker_token text;
begin
 if not exists(select 1 from public.community_automod_settings s where s.enabled
   and (s.lease_until is null or s.lease_until<=now())
   and exists(select 1 from public.community_automod_jobs j where j.state='queued'
     or (j.state='clear' and s.auto_publish) or (j.state='processing' and j.lease_until<=now()))) then return; end if;
 select decrypted_secret into target from vault.decrypted_secrets where name='community_automod_url';
 select decrypted_secret into worker_token from vault.decrypted_secrets where name='community_automod_token';
 if target is null or target !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/auto-moderate$'
   or worker_token is null or length(worker_token)<32 then raise exception 'community_scheduler_not_configured'; end if;
 perform net.http_post(url:=target,headers:=jsonb_build_object('Content-Type','application/json','x-community-worker',worker_token),body:='{}'::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function public.community_automod_tick() from public,anon,authenticated,service_role;
select cron.schedule('community-automod-minute','* * * * *','select public.community_automod_tick();');

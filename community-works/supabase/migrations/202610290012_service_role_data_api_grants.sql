-- New hosted projects may not grant service_role access to newly created tables.
-- Keep direct Data API access to the columns/routes used by the community BFF
-- and Edge Functions. Human clients retain their separate RLS grants.
grant usage on schema public to service_role;

grant select on public.community_publications,
  public.community_upload_sessions,
  public.community_submissions,
  public.community_reviewers,
  public.community_reports,
  public.community_comments,
  public.community_comment_reports,
  public.community_appeals
  to service_role;

-- The cleanup job and verifier change only upload-session status/receipt.
grant update on public.community_upload_sessions to service_role;

-- A verified private object becomes a submission through the Edge Function.
grant insert on public.community_submissions to service_role;

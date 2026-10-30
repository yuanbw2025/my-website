-- The reviewer stages a private immutable copy before publishing metadata.
-- A failed transaction can leave an object; the cleanup job keeps the receipt.
create table public.community_publication_copies (
  object_path text primary key check (object_path ~ '^published/[0-9a-f-]{36}/[0-9a-f]{64}/snapshot[.]json$'),
  submission_id uuid not null references public.community_submissions(id),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('pending', 'published', 'purged')),
  created_at timestamptz not null default now(),
  purged_at timestamptz,
  constraint publication_copy_path check (object_path =
    'published/' || submission_id::text || '/' || sha256 || '/snapshot.json')
);
create index community_publication_copies_pending
  on public.community_publication_copies (created_at, object_path)
  where status = 'pending' and purged_at is null;
alter table public.community_publication_copies enable row level security;
revoke all on public.community_publication_copies from anon, authenticated;
grant select, insert, update on public.community_publication_copies to service_role;

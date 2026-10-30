-- Public catalog only. No submission, moderation, or private manuscript data lives here.
-- Deployment remains gated until the private intake and human review path is complete.
create table if not exists public.community_publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,100}$'),
  kind text not null check (kind in ('novel', 'book-analysis')),
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '' check (char_length(description) <= 4000),
  author_name text not null check (char_length(author_name) between 1 and 120),
  language text not null default 'zh-CN' check (char_length(language) <= 30),
  object_path text not null check (object_path ~ '^published/[0-9a-f-]{36}/[0-9a-f]{64}/snapshot[.]json$'),
  status text not null default 'taken_down' check (status in ('published', 'taken_down')),
  approved_revision_sha256 text not null check (approved_revision_sha256 ~ '^[0-9a-f]{64}$'),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint published_requires_time check (status <> 'published' or published_at is not null)
);

create index if not exists community_publications_visible_order
  on public.community_publications (published_at desc, id desc)
  where status = 'published';

alter table public.community_publications enable row level security;
revoke all on public.community_publications from anon, authenticated;
grant select on public.community_publications to anon, authenticated;

create policy community_publications_visible_read
  on public.community_publications for select
  to anon, authenticated
  using (status = 'published' and published_at is not null);

comment on table public.community_publications is
  'Only an audited moderation decision may create or update a published row. Public RLS excludes taken-down rows.';

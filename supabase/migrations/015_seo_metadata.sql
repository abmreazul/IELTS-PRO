-- SEO metadata overrides (admin-managed)
create table if not exists public.seo_metadata (
  id          uuid primary key default gen_random_uuid(),
  page_path   text not null unique,
  meta_title  text,
  meta_description text,
  og_image_url text,
  canonical_url text,
  no_index    boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

-- RLS enabled but no policies → only service-role can access
alter table public.seo_metadata enable row level security;

create index if not exists idx_seo_metadata_path on public.seo_metadata(page_path);

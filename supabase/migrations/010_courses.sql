create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  instructor text,
  level text not null default 'all-levels'
    check (level in ('all-levels', 'beginner', 'intermediate', 'advanced')),
  cover_image_url text,
  lessons_json jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_slug_idx on public.courses (slug);

alter table public.courses enable row level security;

drop policy if exists "courses_select_published" on public.courses;
create policy "courses_select_published"
  on public.courses for select
  to anon, authenticated
  using (is_published = true);

create or replace function public.set_courses_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
  before update on public.courses
  for each row execute procedure public.set_courses_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values ('course-media', 'course-media', true, 524288000)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "course_media_public_read" on storage.objects;
create policy "course_media_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'course-media');

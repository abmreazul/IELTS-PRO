-- Mock exam catalog, entitlements, attempts. Run in Supabase SQL Editor after 001/002.

create table if not exists public.exam_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0
);

create table if not exists public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.exam_categories (id) on delete restrict,
  title text not null,
  slug text not null unique,
  description text,
  exam_type text not null check (exam_type in ('full', 'partial')),
  modules text[] not null default '{}',
  duration_minutes int not null default 30,
  question_count int not null default 40,
  difficulty text not null default 'intermediate'
    check (difficulty in ('beginner', 'intermediate', 'advanced')),
  price_cents int not null default 999,
  currency text not null default 'USD',
  cover_image_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  exam_id uuid not null references public.mock_exams (id) on delete cascade,
  granted_at timestamptz not null default now(),
  source text default 'manual',
  primary key (user_id, exam_id)
);

create table if not exists public.mock_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exam_id uuid not null references public.mock_exams (id) on delete cascade,
  status text not null check (status in ('in_progress', 'completed')),
  listening_band numeric(3, 1),
  reading_band numeric(3, 1),
  writing_band numeric(3, 1),
  speaking_band numeric(3, 1),
  overall_band numeric(3, 1),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mock_attempts_user_exam_created_idx
  on public.mock_attempts (user_id, exam_id, created_at desc);

alter table public.exam_categories enable row level security;
alter table public.mock_exams enable row level security;
alter table public.exam_entitlements enable row level security;
alter table public.mock_attempts enable row level security;

create policy "exam_categories_select_all"
  on public.exam_categories for select
  to anon, authenticated
  using (true);

create policy "mock_exams_select_published"
  on public.mock_exams for select
  to anon, authenticated
  using (is_published = true);

create policy "exam_entitlements_select_own"
  on public.exam_entitlements for select
  to authenticated
  using (auth.uid() = user_id);

create policy "exam_entitlements_insert_own"
  on public.exam_entitlements for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "mock_attempts_select_own"
  on public.mock_attempts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "mock_attempts_insert_own"
  on public.mock_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "mock_attempts_update_own"
  on public.mock_attempts for update
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_mock_exams_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mock_exams_set_updated_at on public.mock_exams;
create trigger mock_exams_set_updated_at
  before update on public.mock_exams
  for each row execute procedure public.set_mock_exams_updated_at();

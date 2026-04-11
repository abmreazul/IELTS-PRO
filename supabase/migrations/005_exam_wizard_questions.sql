-- Exam wizard: per-section structure, scoring config, and question bank.

alter table public.mock_exams
  add column if not exists structure_json jsonb not null default '[]'::jsonb;

alter table public.mock_exams
  add column if not exists scoring_json jsonb not null default '{}'::jsonb;

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.mock_exams (id) on delete cascade,
  sort_order int not null default 0,
  module text not null
    check (module in ('listening', 'reading', 'writing', 'speaking')),
  question_type text not null,
  prompt text not null default '',
  options_json jsonb not null default '[]'::jsonb,
  correct_json jsonb,
  points int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists exam_questions_exam_sort_idx
  on public.exam_questions (exam_id, sort_order);

alter table public.exam_questions enable row level security;

create policy "exam_questions_select_if_exam_published"
  on public.exam_questions for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.mock_exams e
      where e.id = exam_questions.exam_id
        and e.is_published = true
    )
  );

-- Store submitted responses and subjective-review state for Writing / Speaking attempts.

alter table public.mock_attempts
  add column if not exists answers_json jsonb not null default '{}'::jsonb;

alter table public.mock_attempts
  add column if not exists review_status text not null default 'not_required'
    check (review_status in ('not_required', 'pending', 'reviewed'));

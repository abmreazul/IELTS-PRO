alter table public.mock_attempts
  add column if not exists ai_review_json jsonb;

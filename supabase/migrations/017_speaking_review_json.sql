alter table public.mock_attempts
  add column if not exists speaking_review_json jsonb;

-- Private storage and review metadata for recorded speaking attempts.

alter table public.mock_attempts
  add column if not exists speaking_review_notes text;

alter table public.mock_attempts
  add column if not exists reviewed_at timestamptz;

alter table public.mock_attempts
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attempt-media',
  'attempt-media',
  false,
  52428800,
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

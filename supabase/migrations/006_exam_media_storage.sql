-- Public bucket for exam cover images and listening audio (uploads via service role from admin server actions).
-- Run after 005.

alter table public.mock_exams
  add column if not exists listening_audio_json jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('exam-media', 'exam-media', true, 52428800)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "exam_media_public_read" on storage.objects;
create policy "exam_media_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'exam-media');

-- Tighten RLS, fix linter warnings, and add missing FK indexes.

create or replace function public.set_mock_exams_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "Service role full access" on public.exam_entitlements;
drop policy if exists "Service role full access" on public.exam_questions;
drop policy if exists "Service role full access" on public.mock_attempts;

drop policy if exists "exam_entitlements_select_own" on public.exam_entitlements;
create policy "exam_entitlements_select_own"
  on public.exam_entitlements for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "exam_entitlements_insert_own" on public.exam_entitlements;
create policy "exam_entitlements_insert_own"
  on public.exam_entitlements for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "mock_attempts_select_own" on public.mock_attempts;
create policy "mock_attempts_select_own"
  on public.mock_attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "mock_attempts_insert_own" on public.mock_attempts;
create policy "mock_attempts_insert_own"
  on public.mock_attempts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "mock_attempts_update_own" on public.mock_attempts;
create policy "mock_attempts_update_own"
  on public.mock_attempts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists mock_exams_category_id_idx
  on public.mock_exams (category_id);

create index if not exists exam_entitlements_exam_id_idx
  on public.exam_entitlements (exam_id);

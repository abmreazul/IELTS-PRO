create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exam_id uuid not null references public.mock_exams (id) on delete cascade,
  payment_method text not null
    check (payment_method in ('bkash', 'touchngo', 'ebl', 'maybank')),
  transaction_id text not null,
  proof_url text,
  amount_cents int not null,
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_requests_user_exam_created_idx
  on public.payment_requests (user_id, exam_id, created_at desc);

create index if not exists payment_requests_status_created_idx
  on public.payment_requests (status, created_at desc);

alter table public.payment_requests enable row level security;

drop policy if exists "payment_requests_select_own" on public.payment_requests;
create policy "payment_requests_select_own"
  on public.payment_requests for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "payment_requests_insert_own" on public.payment_requests;
create policy "payment_requests_insert_own"
  on public.payment_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create or replace function public.set_payment_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_requests_set_updated_at on public.payment_requests;
create trigger payment_requests_set_updated_at
  before update on public.payment_requests
  for each row execute procedure public.set_payment_requests_updated_at();

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do update
set public = excluded.public;

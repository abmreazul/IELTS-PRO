alter table public.mock_exams
  add column if not exists display_order int not null default 0;

create index if not exists mock_exams_display_order_idx
  on public.mock_exams (display_order, created_at desc);

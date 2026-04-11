-- Optional seed data (run once after 003). Adjust or delete as needed.

insert into public.exam_categories (slug, name, sort_order)
values
  ('listening', 'Listening', 1),
  ('reading', 'Reading', 2),
  ('writing', 'Writing', 3),
  ('speaking', 'Speaking', 4),
  ('full-exams', 'Full exams', 5)
on conflict (slug) do nothing;

insert into public.mock_exams (
  category_id,
  title,
  slug,
  description,
  exam_type,
  modules,
  duration_minutes,
  question_count,
  difficulty,
  price_cents,
  currency,
  cover_image_url,
  is_published
)
select
  c.id,
  'IELTS Listening Practice Test',
  'ielts-listening-practice-1',
  'Timed listening practice with authentic task types.',
  'partial',
  array['listening']::text[],
  30,
  40,
  'beginner',
  999,
  'USD',
  'https://images.unsplash.com/photo-1590602847861-f357a9332c77?w=800&q=80',
  true
from public.exam_categories c
where c.slug = 'listening'
on conflict (slug) do nothing;

insert into public.mock_exams (
  category_id,
  title,
  slug,
  description,
  exam_type,
  modules,
  duration_minutes,
  question_count,
  difficulty,
  price_cents,
  currency,
  cover_image_url,
  is_published
)
select
  c.id,
  'IELTS Reading Practice Test',
  'ielts-reading-practice-1',
  'Full reading section simulation.',
  'partial',
  array['reading']::text[],
  60,
  40,
  'intermediate',
  1299,
  'USD',
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80',
  true
from public.exam_categories c
where c.slug = 'reading'
on conflict (slug) do nothing;

insert into public.mock_exams (
  category_id,
  title,
  slug,
  description,
  exam_type,
  modules,
  duration_minutes,
  question_count,
  difficulty,
  price_cents,
  currency,
  cover_image_url,
  is_published
)
select
  c.id,
  'IELTS Academic Full Mock',
  'ielts-academic-full-1',
  'All four skills in one sitting.',
  'full',
  array['listening', 'reading', 'writing', 'speaking']::text[],
  175,
  120,
  'advanced',
  4999,
  'USD',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80',
  true
from public.exam_categories c
where c.slug = 'full-exams'
on conflict (slug) do nothing;

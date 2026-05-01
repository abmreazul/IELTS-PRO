-- Add multi-currency price columns to mock_exams
alter table public.mock_exams
  add column if not exists price_usd_cents integer not null default 0,
  add column if not exists price_bdt_cents integer not null default 0,
  add column if not exists price_myr_cents integer not null default 0;

-- Migrate existing price_cents → price_usd_cents (if currency was USD or unset)
update public.mock_exams
  set price_usd_cents = price_cents
  where price_cents > 0 and (currency is null or currency = '' or upper(currency) = 'USD');

-- Migrate BDT prices
update public.mock_exams
  set price_bdt_cents = price_cents
  where price_cents > 0 and upper(currency) = 'BDT';

-- Migrate MYR prices
update public.mock_exams
  set price_myr_cents = price_cents
  where price_cents > 0 and upper(currency) = 'MYR';

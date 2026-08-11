-- Add PayPal to the existing manual-payment approval workflow.
-- Requests are created by the validated server action with the service role;
-- direct client inserts would bypass amount, currency, and method validation.

drop policy if exists "payment_requests_insert_own"
  on public.payment_requests;

alter table public.payment_requests
  drop constraint if exists payment_requests_payment_method_check;

alter table public.payment_requests
  add constraint payment_requests_payment_method_check
  check (payment_method in ('bkash', 'touchngo', 'ebl', 'maybank', 'paypal'));

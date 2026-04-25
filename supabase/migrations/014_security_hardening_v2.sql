-- Fix #1: Remove the insert policy that lets any authenticated user
-- grant themselves access to paid exams (payment bypass vulnerability).
-- Only the service_role (admin server actions) should insert entitlements.

drop policy if exists "exam_entitlements_insert_own" on public.exam_entitlements;

-- Fix #3: Make payment-proofs bucket private.
-- Receipts may contain personal banking information and must not be
-- publicly accessible. Admin views proofs via service_role signed URLs.

update storage.buckets
set public = false
where id = 'payment-proofs';

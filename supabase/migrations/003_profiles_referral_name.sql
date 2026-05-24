-- Add referral_name to profiles and copy it from auth metadata for new signups.

alter table public.profiles
  add column if not exists referral_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, institution, referral_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'institution', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'referral_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles p
set referral_name = nullif(trim(coalesce(au.raw_user_meta_data->>'referral_name', '')), '')
from auth.users au
where au.id = p.id
  and (p.referral_name is null or p.referral_name = '')
  and nullif(trim(coalesce(au.raw_user_meta_data->>'referral_name', '')), '') is not null;

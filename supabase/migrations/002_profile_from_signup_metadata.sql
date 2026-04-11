-- Run after 001_profiles.sql. Copies full_name / institution from auth.users raw_user_meta_data into profiles on signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, institution)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'institution', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

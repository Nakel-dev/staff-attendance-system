-- Fix profile RLS: stop recursive policy checks and always allow own-profile reads

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.get_my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;

-- Profiles SELECT
drop policy if exists "Admins can view org profiles" on profiles;
drop policy if exists "Staff can view own profile" on profiles;
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Admins can view all profiles" on profiles;

create policy "Users can view own profile" on profiles
  for select using (user_id = auth.uid());

create policy "Admins can view org profiles" on profiles
  for select using (
    public.is_org_admin()
    and organization_id = public.get_my_organization_id()
  );

-- Profiles UPDATE
drop policy if exists "Admins can update org profiles" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Admins can update profiles" on profiles;

create policy "Users can update own profile" on profiles
  for update using (user_id = auth.uid());

create policy "Admins can update org profiles" on profiles
  for update using (
    public.is_org_admin()
    and organization_id = public.get_my_organization_id()
  );

-- Profiles INSERT (registration uses service role; admins add staff)
drop policy if exists "Admins can insert org profiles" on profiles;
drop policy if exists "Admins can insert profiles" on profiles;

create policy "Admins can insert org profiles" on profiles
  for insert with check (
    public.is_org_admin()
    and organization_id = public.get_my_organization_id()
  );

-- Organizations SELECT (already uses security definer helper)
drop policy if exists "Members can view own organization" on organizations;
create policy "Members can view own organization" on organizations
  for select using (id = public.get_my_organization_id());

-- Multi-tenant organizations support
create extension if not exists "uuid-ossp";

create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  invite_code text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles add column if not exists organization_id uuid references organizations(id) on delete cascade;

-- Backfill existing data into a default organization
insert into organizations (name, slug, invite_code)
select 'Legacy Organization', 'legacy-org', 'LEGACY01'
where not exists (select 1 from organizations where slug = 'legacy-org');

update profiles
set organization_id = (select id from organizations where slug = 'legacy-org' limit 1)
where organization_id is null;

alter table profiles alter column organization_id set not null;

create index if not exists idx_profiles_organization_id on profiles(organization_id);
create index if not exists idx_organizations_invite_code on organizations(invite_code);

-- Helper: current user's organization
create or replace function public.get_my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where user_id = auth.uid() limit 1;
$$;

alter table organizations enable row level security;

drop policy if exists "Members can view own organization" on organizations;
create policy "Members can view own organization" on organizations
  for select using (id = public.get_my_organization_id());

drop policy if exists "Admins can view all profiles" on profiles;
drop policy if exists "Staff can view own profile" on profiles;
drop policy if exists "Admins can insert profiles" on profiles;
drop policy if exists "Admins can update profiles" on profiles;

create policy "Admins can view org profiles" on profiles for select using (
  organization_id = public.get_my_organization_id()
  and exists (
    select 1 from profiles p
    where p.user_id = auth.uid() and p.role = 'admin' and p.organization_id = public.get_my_organization_id()
  )
);
create policy "Staff can view own profile" on profiles for select using (user_id = auth.uid());
create policy "Admins can insert org profiles" on profiles for insert with check (
  organization_id = public.get_my_organization_id()
  and exists (
    select 1 from profiles p
    where p.user_id = auth.uid() and p.role = 'admin' and p.organization_id = public.get_my_organization_id()
  )
);
create policy "Admins can update org profiles" on profiles for update using (
  organization_id = public.get_my_organization_id()
  and exists (
    select 1 from profiles p
    where p.user_id = auth.uid() and p.role = 'admin' and p.organization_id = public.get_my_organization_id()
  )
);

drop policy if exists "Admins can manage all attendance" on attendance;
drop policy if exists "Staff can view own attendance" on attendance;
drop policy if exists "Staff can insert own attendance" on attendance;
drop policy if exists "Staff can update own attendance" on attendance;

create policy "Admins manage org attendance" on attendance for all using (
  exists (
    select 1 from profiles staff
    join profiles admin on admin.user_id = auth.uid()
    where staff.id = attendance.staff_id
      and staff.organization_id = admin.organization_id
      and admin.role = 'admin'
  )
);
create policy "Staff view own attendance" on attendance for select using (
  staff_id = (select id from profiles where user_id = auth.uid())
);
create policy "Staff insert own attendance" on attendance for insert with check (
  staff_id = (select id from profiles where user_id = auth.uid())
);
create policy "Staff update own attendance" on attendance for update using (
  staff_id = (select id from profiles where user_id = auth.uid())
);

drop policy if exists "Admins can manage all leaves" on leaves;
drop policy if exists "Staff can view own leaves" on leaves;
drop policy if exists "Staff can insert own leaves" on leaves;

create policy "Admins manage org leaves" on leaves for all using (
  exists (
    select 1 from profiles staff
    join profiles admin on admin.user_id = auth.uid()
    where staff.id = leaves.staff_id
      and staff.organization_id = admin.organization_id
      and admin.role = 'admin'
  )
);
create policy "Staff view own leaves" on leaves for select using (
  staff_id = (select id from profiles where user_id = auth.uid())
);
create policy "Staff insert own leaves" on leaves for insert with check (
  staff_id = (select id from profiles where user_id = auth.uid())
);

drop policy if exists "Users can view own notifications" on notifications;
drop policy if exists "Users can update own notifications" on notifications;
drop policy if exists "Authenticated users can insert notifications" on notifications;

create policy "Users view own notifications" on notifications for select using (
  user_id = (select id from profiles where user_id = auth.uid())
);
create policy "Users update own notifications" on notifications for update using (
  user_id = (select id from profiles where user_id = auth.uid())
);
create policy "Org members insert notifications" on notifications for insert with check (
  exists (
    select 1 from profiles sender
    join profiles recipient on recipient.id = notifications.user_id
    where sender.user_id = auth.uid()
      and sender.organization_id = recipient.organization_id
  )
);

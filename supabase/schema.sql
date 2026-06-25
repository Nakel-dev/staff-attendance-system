-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Organizations (multi-tenant)
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  invite_code text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Profiles table (extends Supabase auth.users)
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  organization_id uuid references organizations(id) on delete cascade not null,
  full_name text not null,
  email text not null unique,
  phone text,
  department text not null,
  role text not null check (role in ('admin', 'staff')),
  avatar_url text,
  is_active boolean default true,
  date_joined date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Attendance table
create table if not exists attendance (
  id uuid primary key default uuid_generate_v4(),
  staff_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'half-day')),
  check_in_time time,
  check_out_time time,
  note text,
  marked_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(staff_id, date)
);

-- Leaves table
create table if not exists leaves (
  id uuid primary key default uuid_generate_v4(),
  staff_id uuid references profiles(id) on delete cascade not null,
  leave_type text not null check (leave_type in ('sick', 'annual', 'emergency', 'maternity', 'unpaid')),
  start_date date not null,
  end_date date not null,
  total_days integer generated always as (end_date - start_date + 1) stored,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Notifications table
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text not null check (type in ('leave_request', 'leave_approved', 'leave_rejected', 'attendance_marked', 'general')),
  is_read boolean default false,
  created_at timestamptz default now()
);

-- RLS Policies
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table attendance enable row level security;
alter table leaves enable row level security;
alter table notifications enable row level security;

create or replace function public.get_my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where user_id = auth.uid() limit 1;
$$;

drop policy if exists "Members can view own organization" on organizations;
create policy "Members can view own organization" on organizations
  for select using (id = public.get_my_organization_id());

drop policy if exists "Admins can view all profiles" on profiles;
drop policy if exists "Staff can view own profile" on profiles;
drop policy if exists "Admins can insert profiles" on profiles;
drop policy if exists "Admins can update profiles" on profiles;
drop policy if exists "Admins can manage all attendance" on attendance;
drop policy if exists "Staff can view own attendance" on attendance;
drop policy if exists "Staff can insert own attendance" on attendance;
drop policy if exists "Staff can update own attendance" on attendance;
drop policy if exists "Admins can manage all leaves" on leaves;
drop policy if exists "Staff can view own leaves" on leaves;
drop policy if exists "Staff can insert own leaves" on leaves;
drop policy if exists "Users can view own notifications" on notifications;
drop policy if exists "Users can update own notifications" on notifications;
drop policy if exists "Authenticated users can insert notifications" on notifications;

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

drop policy if exists "Admins can insert org profiles" on profiles;
drop policy if exists "Admins can insert profiles" on profiles;

create policy "Admins can insert org profiles" on profiles
  for insert with check (
    public.is_org_admin()
    and organization_id = public.get_my_organization_id()
  );

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

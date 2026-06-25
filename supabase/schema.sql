-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
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
alter table profiles enable row level security;
alter table attendance enable row level security;
alter table leaves enable row level security;
alter table notifications enable row level security;

-- Drop existing policies if re-running
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

-- Profiles RLS
create policy "Admins can view all profiles" on profiles for select using (
  exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
);
create policy "Staff can view own profile" on profiles for select using (user_id = auth.uid());
create policy "Admins can insert profiles" on profiles for insert with check (
  exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
);
create policy "Admins can update profiles" on profiles for update using (
  exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
);

-- Attendance RLS
create policy "Admins can manage all attendance" on attendance for all using (
  exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
);
create policy "Staff can view own attendance" on attendance for select using (
  staff_id = (select id from profiles where user_id = auth.uid())
);
create policy "Staff can insert own attendance" on attendance for insert with check (
  staff_id = (select id from profiles where user_id = auth.uid())
);
create policy "Staff can update own attendance" on attendance for update using (
  staff_id = (select id from profiles where user_id = auth.uid())
);

-- Leaves RLS
create policy "Admins can manage all leaves" on leaves for all using (
  exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
);
create policy "Staff can view own leaves" on leaves for select using (
  staff_id = (select id from profiles where user_id = auth.uid())
);
create policy "Staff can insert own leaves" on leaves for insert with check (
  staff_id = (select id from profiles where user_id = auth.uid())
);

-- Notifications RLS
create policy "Users can view own notifications" on notifications for select using (
  user_id = (select id from profiles where user_id = auth.uid())
);
create policy "Users can update own notifications" on notifications for update using (
  user_id = (select id from profiles where user_id = auth.uid())
);
create policy "Authenticated users can insert notifications" on notifications for insert with check (
  exists (select 1 from profiles where user_id = auth.uid())
);

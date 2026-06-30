-- Video liveness verification, audit logs, and database-level check-in enforcement

alter table attendance add column if not exists check_in_video_url text;
alter table attendance add column if not exists liveness_passed boolean;
alter table attendance add column if not exists liveness_score double precision;

alter table profiles add column if not exists face_reference_video_url text;
alter table profiles add column if not exists face_liveness_score double precision;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'check-in-videos',
  'check-in-videos',
  false,
  15728640,
  array['video/webm', 'video/mp4']
)
on conflict (id) do nothing;

drop policy if exists "Staff upload check-in videos" on storage.objects;
create policy "Staff upload check-in videos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'check-in-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read own check-in videos" on storage.objects;
create policy "Users read own check-in videos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'check-in-videos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from profiles viewer
        join profiles owner on owner.user_id::text = (storage.foldername(name))[1]
        where viewer.user_id = auth.uid()
          and viewer.role = 'admin'
          and viewer.organization_id = owner.organization_id
      )
    )
  );

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  request_id text,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;

drop policy if exists "Admins view org audit logs" on audit_logs;
create policy "Admins view org audit logs" on audit_logs
  for select to authenticated
  using (
    organization_id = public.get_my_organization_id()
    and public.is_org_admin()
  );

revoke all on table organizations from authenticated;
grant select (
  id,
  name,
  slug,
  invite_code,
  attendance_mode,
  office_latitude,
  office_longitude,
  geofence_radius_m,
  created_at,
  updated_at
) on table organizations to authenticated;

create or replace function public.prevent_face_descriptor_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.user_id then
    if new.face_descriptor is distinct from old.face_descriptor
       and new.face_descriptor is not null then
      raise exception 'Face enrollment must use the official enrollment flow';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_face_descriptor_guard on profiles;
create trigger profiles_face_descriptor_guard
  before update on profiles
  for each row
  execute function public.prevent_face_descriptor_tampering();

create or replace function public.enforce_self_checkin_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_mode text;
  org_lat double precision;
  org_lng double precision;
  org_radius integer;
begin
  if new.marked_by is not null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.check_in_time is not distinct from old.check_in_time then
    return new;
  end if;

  if new.check_in_time is null then
    return new;
  end if;

  select o.attendance_mode, o.office_latitude, o.office_longitude, o.geofence_radius_m
  into org_mode, org_lat, org_lng, org_radius
  from profiles p
  join organizations o on o.id = p.organization_id
  where p.id = new.staff_id;

  if org_mode = 'admin_only' then
    raise exception 'Self check-in is disabled for this organization';
  end if;

  if org_mode in ('standard', 'strict') then
    if new.liveness_passed is distinct from true then
      raise exception 'Video liveness verification is required';
    end if;
    if new.face_match_passed is distinct from true then
      raise exception 'Face match verification is required';
    end if;
    if new.check_in_video_url is null and new.check_in_photo_url is null then
      raise exception 'Check-in media evidence is required';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_self_checkin_guard on attendance;
create trigger attendance_self_checkin_guard
  before insert or update on attendance
  for each row
  execute function public.enforce_self_checkin_rules();

-- Run once in Supabase SQL Editor if npm run migrate:secure is unavailable.
-- Applies migrations 005 + 006 (anti-cheat + face match)

-- 005: Anti-cheat attendance
alter table organizations add column if not exists attendance_mode text not null default 'trust'
  check (attendance_mode in ('trust', 'standard', 'strict', 'admin_only'));
alter table organizations add column if not exists office_latitude double precision;
alter table organizations add column if not exists office_longitude double precision;
alter table organizations add column if not exists geofence_radius_m integer not null default 150;
alter table organizations add column if not exists checkin_token text;
alter table organizations add column if not exists checkin_token_expires_at timestamptz;

alter table attendance add column if not exists check_in_latitude double precision;
alter table attendance add column if not exists check_in_longitude double precision;
alter table attendance add column if not exists check_in_photo_url text;
alter table attendance add column if not exists check_in_method text default 'self'
  check (check_in_method in ('self', 'admin', 'qr'));
alter table attendance add column if not exists verification_flag boolean not null default false;
alter table attendance add column if not exists verification_note text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'check-in-photos',
  'check-in-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Staff upload check-in photos" on storage.objects;
create policy "Staff upload check-in photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'check-in-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read own check-in photos" on storage.objects;
create policy "Users read own check-in photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'check-in-photos'
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

-- 006: Face match
alter table profiles add column if not exists face_descriptor jsonb;
alter table profiles add column if not exists face_enrolled_at timestamptz;
alter table profiles add column if not exists face_reference_photo_url text;

alter table attendance add column if not exists face_match_score double precision;
alter table attendance add column if not exists face_match_passed boolean;

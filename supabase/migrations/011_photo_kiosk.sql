-- Photo kiosk: PIN auth, attendance photos, expanded review reasons

alter table profiles add column if not exists kiosk_pin_hash text;

comment on column profiles.kiosk_pin_hash is
  'Scrypt hash of 4-digit kiosk PIN set by admin. Never store plain PIN.';

alter table attendance_records add column if not exists photo_capture_url text;

comment on column attendance_records.photo_capture_url is
  'Storage path in kiosk-attendance-photos bucket for this clock event.';

-- Expand review_queue.reason
alter table review_queue drop constraint if exists review_queue_reason_check;
alter table review_queue add constraint review_queue_reason_check
  check (reason in (
    'low_confidence',
    'no_match',
    'liveness_fail',
    'missing_photo',
    'duplicate_day',
    'photo_review'
  ));

-- Expand clock_attempts.outcome
alter table clock_attempts drop constraint if exists clock_attempts_outcome_check;
alter table clock_attempts add constraint clock_attempts_outcome_check
  check (outcome in (
    'success',
    'liveness_fail',
    'no_match',
    'low_confidence',
    'rate_limited',
    'duplicate',
    'session_invalid',
    'staff_inactive',
    'no_embeddings',
    'invalid_pin',
    'missing_photo',
    'duplicate_day',
    'photo_review'
  ));

-- Profile photos (staff + admin upload; private bucket)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Kiosk attendance capture photos (service role upload only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kiosk-attendance-photos',
  'kiosk-attendance-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Staff upload own profile photo: profile-photos/{org_id}/{profile_id}/...
drop policy if exists "Staff upload own profile photos" on storage.objects;
create policy "Staff upload own profile photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (
      select organization_id::text from profiles where user_id = auth.uid()
    )
    and (storage.foldername(name))[2] = (
      select id::text from profiles where user_id = auth.uid()
    )
  );

drop policy if exists "Staff update own profile photos" on storage.objects;
create policy "Staff update own profile photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (
      select organization_id::text from profiles where user_id = auth.uid()
    )
    and (storage.foldername(name))[2] = (
      select id::text from profiles where user_id = auth.uid()
    )
  );

drop policy if exists "Org members read profile photos" on storage.objects;
create policy "Org members read profile photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and exists (
      select 1
      from profiles viewer
      where viewer.user_id = auth.uid()
        and viewer.organization_id::text = (storage.foldername(name))[1]
    )
  );

-- Admins upload profile photos for staff in their org
drop policy if exists "Admins upload org profile photos" on storage.objects;
create policy "Admins upload org profile photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and exists (
      select 1
      from profiles admin_p
      join profiles target on target.id::text = (storage.foldername(name))[2]
      where admin_p.user_id = auth.uid()
        and admin_p.role = 'admin'
        and admin_p.organization_id = target.organization_id
        and admin_p.organization_id::text = (storage.foldername(name))[1]
    )
  );

-- Admins read kiosk attendance photos in their org
drop policy if exists "Admins read org kiosk attendance photos" on storage.objects;
create policy "Admins read org kiosk attendance photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kiosk-attendance-photos'
    and exists (
      select 1
      from profiles viewer
      where viewer.user_id = auth.uid()
        and viewer.role = 'admin'
        and viewer.organization_id::text = (storage.foldername(name))[1]
    )
  );

-- Granular security toggles + check-out verification columns

alter table organizations add column if not exists require_video_verification boolean not null default true;
alter table organizations add column if not exists require_face_match boolean not null default true;
alter table organizations add column if not exists require_geofence boolean not null default true;
alter table organizations add column if not exists require_qr_code boolean not null default false;

alter table attendance add column if not exists check_out_video_url text;
alter table attendance add column if not exists check_out_liveness_passed boolean;
alter table attendance add column if not exists check_out_face_match_passed boolean;

update organizations
set
  attendance_mode = 'standard',
  require_video_verification = true,
  require_face_match = true,
  require_geofence = true,
  require_qr_code = false
where attendance_mode = 'trust';

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
  require_video_verification,
  require_face_match,
  require_geofence,
  require_qr_code,
  created_at,
  updated_at
) on table organizations to authenticated;

-- Face enrollment and verification for anti-buddy-punch check-in

alter table profiles add column if not exists face_descriptor jsonb;
alter table profiles add column if not exists face_enrolled_at timestamptz;
alter table profiles add column if not exists face_reference_photo_url text;

alter table attendance add column if not exists face_match_score double precision;
alter table attendance add column if not exists face_match_passed boolean;

-- Bind one Didit identity (document) to one enrolled staff profile per organization.

alter table profiles add column if not exists didit_identity_key text;
alter table profiles add column if not exists didit_enrollment_session_id text;

comment on column profiles.didit_identity_key is
  'SHA-256 of normalized Didit ID document fields; one enrolled identity per org';
comment on column profiles.didit_enrollment_session_id is
  'Didit KYC session id used for portal enrollment (face reference for clock)';

create unique index if not exists profiles_org_didit_identity_uq
  on profiles (organization_id, didit_identity_key)
  where didit_identity_key is not null and face_enrolled_at is not null;

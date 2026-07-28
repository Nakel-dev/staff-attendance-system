-- Admin-selectable biometric provider for face match + liveness (no ID/KYC).
-- local = free on-device face-api + motion liveness
-- didit = Didit biometric authentication (if configured)
-- aws = Amazon Rekognition CompareFaces + local liveness assist (pay-as-you-go)

alter table organizations
  add column if not exists biometric_provider text not null default 'local';

alter table organizations
  drop constraint if exists organizations_biometric_provider_check;

alter table organizations
  add constraint organizations_biometric_provider_check
  check (biometric_provider in ('local', 'didit', 'aws'));

comment on column organizations.biometric_provider is
  'Face biometric backend: local | didit | aws';

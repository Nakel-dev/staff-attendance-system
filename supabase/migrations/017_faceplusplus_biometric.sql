-- Replace AWS with Face++ as biometric provider option.
-- Order matters: drop constraint BEFORE writing faceplusplus values.

alter table public.organizations
  drop constraint if exists organizations_biometric_provider_check;

update public.organizations
set biometric_provider = 'faceplusplus'
where biometric_provider = 'aws';

alter table public.organizations
  add constraint organizations_biometric_provider_check
  check (biometric_provider in ('local', 'didit', 'faceplusplus'));

alter table public.organizations
  alter column biometric_provider set default 'faceplusplus';

comment on column public.organizations.biometric_provider is
  'Face biometric backend: faceplusplus (default) | local | didit';

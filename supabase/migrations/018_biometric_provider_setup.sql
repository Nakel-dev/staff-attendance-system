-- One-shot setup for organizations.biometric_provider (Face++ / Didit / Local).
-- Safe to re-run. Run this in Supabase SQL Editor if settings save fails.

alter table public.organizations
  add column if not exists biometric_provider text;

update public.organizations
set biometric_provider = 'faceplusplus'
where biometric_provider is null or biometric_provider = 'aws';

alter table public.organizations
  alter column biometric_provider set default 'faceplusplus';

alter table public.organizations
  alter column biometric_provider set not null;

alter table public.organizations
  drop constraint if exists organizations_biometric_provider_check;

alter table public.organizations
  add constraint organizations_biometric_provider_check
  check (biometric_provider in ('local', 'didit', 'faceplusplus'));

comment on column public.organizations.biometric_provider is
  'Face biometric backend: faceplusplus (default) | local | didit';

-- Didit-only biometric provider (remove Face++, local, AWS options)

update public.organizations
set biometric_provider = 'didit'
where biometric_provider is distinct from 'didit';

alter table public.organizations
  drop constraint if exists organizations_biometric_provider_check;

alter table public.organizations
  alter column biometric_provider set default 'didit';

alter table public.organizations
  add constraint organizations_biometric_provider_check
  check (biometric_provider = 'didit');

comment on column public.organizations.biometric_provider is
  'Face biometric backend: didit only';

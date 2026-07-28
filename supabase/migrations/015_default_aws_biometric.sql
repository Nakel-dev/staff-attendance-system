-- Default all organizations to AWS Rekognition for face match (requires server env vars).

update organizations
set biometric_provider = 'aws'
where biometric_provider in ('local', 'didit');

alter table organizations
  alter column biometric_provider set default 'aws';

comment on column organizations.biometric_provider is
  'Face biometric backend: aws (default) | local | didit';

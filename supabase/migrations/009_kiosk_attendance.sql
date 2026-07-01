-- Kiosk-only attendance: face embeddings, event log, review queue, legacy sync
-- Requires: existing organizations, profiles, attendance tables (migrations 001-008)

-- ---------------------------------------------------------------------------
-- Extensions & profile employee codes
-- ---------------------------------------------------------------------------
create extension if not exists vector;

alter table profiles add column if not exists employee_code text;

create unique index if not exists profiles_org_employee_code_uq
  on profiles (organization_id, employee_code)
  where employee_code is not null;

comment on column profiles.employee_code is
  'Human-readable staff identifier (e.g. EMP-0042). Unique per organization.';

-- ---------------------------------------------------------------------------
-- Organization kiosk / face-match settings
-- ---------------------------------------------------------------------------
alter table organizations add column if not exists face_match_max_distance double precision not null default 0.6;
alter table organizations add column if not exists clock_attempt_cooldown_seconds integer not null default 30;

comment on column organizations.face_match_max_distance is
  'Max Euclidean distance for face-api descriptors. Lower = stricter. Match when distance <= this value.';
comment on column organizations.clock_attempt_cooldown_seconds is
  'Minimum seconds between clock attempts for the same staff member at the kiosk.';

-- Disable staff self check-in globally (kiosk-only clock in/out)
update organizations
set attendance_mode = 'admin_only'
where attendance_mode is distinct from 'admin_only';

-- Allow kiosk as a check-in method on legacy attendance rows (synced from attendance_records)
alter table attendance drop constraint if exists attendance_check_in_method_check;
alter table attendance add constraint attendance_check_in_method_check
  check (check_in_method in ('self', 'admin', 'qr', 'kiosk'));

alter table attendance add column if not exists kiosk_device_id uuid;
alter table attendance add column if not exists last_kiosk_record_id uuid;

-- ---------------------------------------------------------------------------
-- Kiosks & sessions
-- ---------------------------------------------------------------------------
create table if not exists kiosks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  device_name text not null,
  location text,
  api_key_hash text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists kiosks_organization_id_idx on kiosks (organization_id);

create table if not exists kiosk_sessions (
  id uuid primary key default gen_random_uuid(),
  kiosk_id uuid not null references kiosks(id) on delete cascade,
  session_token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists kiosk_sessions_kiosk_id_idx on kiosk_sessions (kiosk_id);
create index if not exists kiosk_sessions_expires_at_idx on kiosk_sessions (expires_at);

alter table attendance
  drop constraint if exists attendance_kiosk_device_id_fkey;
alter table attendance
  add constraint attendance_kiosk_device_id_fkey
  foreign key (kiosk_device_id) references kiosks(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Face embeddings (pgvector primary; float8[] mirror for portable export/API)
-- ---------------------------------------------------------------------------
create table if not exists face_embeddings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id uuid not null references profiles(id) on delete cascade,
  embedding vector(128) not null,
  embedding_values float8[128] not null,
  angle_label text not null check (angle_label in ('front', 'left', 'right', 'up', 'down')),
  reference_clip_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint face_embeddings_values_len check (array_length(embedding_values, 1) = 128)
);

create unique index if not exists face_embeddings_active_angle_uq
  on face_embeddings (staff_id, angle_label)
  where is_active = true;

create index if not exists face_embeddings_staff_active_idx
  on face_embeddings (staff_id)
  where is_active = true;

-- Optional ANN index: create after embeddings are seeded, e.g.:
-- create index face_embeddings_vector_ivfflat_idx on face_embeddings
--   using ivfflat (embedding extensions.vector_l2_ops) with (lists = 100);

comment on column face_embeddings.embedding is 'Primary pgvector column for similarity search (L2 / Euclidean).';
comment on column face_embeddings.embedding_values is 'Mirror float array for API payloads and non-vector clients.';

-- Keep vector + array in sync on insert/update
create or replace function public.sync_face_embedding_values()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.embedding is not null and (
      new.embedding_values is null
      or array_length(new.embedding_values, 1) is distinct from 128
    ) then
      new.embedding_values := new.embedding::float8[];
    elsif new.embedding_values is not null and new.embedding is null then
      new.embedding := new.embedding_values::vector(128);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.embedding is distinct from old.embedding and new.embedding is not null then
      new.embedding_values := new.embedding::float8[];
    elsif new.embedding_values is distinct from old.embedding_values and new.embedding_values is not null then
      new.embedding := new.embedding_values::vector(128);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists face_embeddings_sync_values on face_embeddings;
create trigger face_embeddings_sync_values
  before insert or update on face_embeddings
  for each row
  execute function public.sync_face_embedding_values();

-- ---------------------------------------------------------------------------
-- Review queue (created before attendance_records FK back-reference)
-- ---------------------------------------------------------------------------
create table if not exists review_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id uuid references profiles(id) on delete set null,
  kiosk_device_id uuid not null references kiosks(id) on delete cascade,
  attempt_type text not null check (attempt_type in ('check_in', 'check_out')),
  reason text not null check (reason in ('low_confidence', 'no_match', 'liveness_fail')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  confidence_score double precision,
  best_match_distance double precision,
  liveness_clip_url text,
  live_capture_url text,
  stored_reference_url text,
  frame_metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists review_queue_org_status_idx
  on review_queue (organization_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Attendance records (append-only event log)
-- ---------------------------------------------------------------------------
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('check_in', 'check_out')),
  server_timestamp timestamptz not null default now(),
  confidence_score double precision,
  best_match_distance double precision,
  match_status text not null check (match_status in ('auto_matched', 'manual_override', 'rejected')),
  liveness_passed boolean not null default false,
  liveness_score double precision,
  liveness_clip_url text,
  kiosk_device_id uuid not null references kiosks(id) on delete restrict,
  reviewed_by uuid references profiles(id) on delete set null,
  review_queue_id uuid references review_queue(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table review_queue
  add column if not exists attendance_record_id uuid references attendance_records(id) on delete set null;

create index if not exists attendance_records_staff_ts_idx
  on attendance_records (staff_id, server_timestamp desc);

create index if not exists attendance_records_org_ts_idx
  on attendance_records (organization_id, server_timestamp desc);

-- Prevent consecutive duplicate check_in / check_out for accepted records
create or replace function public.enforce_attendance_record_alternation()
returns trigger
language plpgsql
as $$
declare
  last_type text;
begin
  if new.match_status not in ('auto_matched', 'manual_override') then
    return new;
  end if;

  select ar.type
  into last_type
  from attendance_records ar
  where ar.staff_id = new.staff_id
    and ar.match_status in ('auto_matched', 'manual_override')
  order by ar.server_timestamp desc, ar.created_at desc
  limit 1;

  if last_type is not null and last_type = new.type then
    raise exception 'duplicate_%: staff already % without opposite action',
      new.type,
      case when new.type = 'check_in' then 'checked in' else 'checked out' end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_attendance_record_alternation on attendance_records;
create trigger trg_attendance_record_alternation
  before insert on attendance_records
  for each row
  execute function public.enforce_attendance_record_alternation();

-- ---------------------------------------------------------------------------
-- Corrections & immutable attempt audit
-- ---------------------------------------------------------------------------
create table if not exists attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  original_record_id uuid not null references attendance_records(id) on delete restrict,
  correction_type text not null check (correction_type in ('void', 'amend', 'manual_add')),
  reason text not null,
  corrected_by uuid not null references profiles(id) on delete restrict,
  new_record_id uuid references attendance_records(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists clock_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kiosk_id uuid not null references kiosks(id) on delete cascade,
  staff_id uuid references profiles(id) on delete set null,
  attempt_type text check (attempt_type in ('check_in', 'check_out')),
  outcome text not null check (outcome in (
    'success',
    'liveness_fail',
    'no_match',
    'low_confidence',
    'rate_limited',
    'duplicate',
    'session_invalid',
    'staff_inactive',
    'no_embeddings'
  )),
  confidence_score double precision,
  best_match_distance double precision,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clock_attempts_staff_created_idx
  on clock_attempts (staff_id, created_at desc);

create index if not exists clock_attempts_kiosk_created_idx
  on clock_attempts (kiosk_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Sync kiosk events into legacy attendance (daily row) for existing reports/UI
-- ---------------------------------------------------------------------------
create or replace function public.sync_legacy_attendance_from_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_date date;
  event_time time;
begin
  if new.match_status not in ('auto_matched', 'manual_override') then
    return new;
  end if;

  event_date := (new.server_timestamp at time zone 'UTC')::date;
  event_time := (new.server_timestamp at time zone 'UTC')::time;

  if new.type = 'check_in' then
    insert into attendance (
      staff_id,
      date,
      status,
      check_in_time,
      check_in_method,
      face_match_score,
      face_match_passed,
      liveness_passed,
      liveness_score,
      check_in_video_url,
      kiosk_device_id,
      last_kiosk_record_id,
      marked_by
    )
    values (
      new.staff_id,
      event_date,
      'present',
      event_time,
      'kiosk',
      new.confidence_score,
      true,
      new.liveness_passed,
      new.liveness_score,
      new.liveness_clip_url,
      new.kiosk_device_id,
      new.id,
      null
    )
    on conflict (staff_id, date) do update
    set
      status = excluded.status,
      check_in_time = coalesce(attendance.check_in_time, excluded.check_in_time),
      check_in_method = 'kiosk',
      face_match_score = excluded.face_match_score,
      face_match_passed = excluded.face_match_passed,
      liveness_passed = excluded.liveness_passed,
      liveness_score = excluded.liveness_score,
      check_in_video_url = coalesce(attendance.check_in_video_url, excluded.check_in_video_url),
      kiosk_device_id = excluded.kiosk_device_id,
      last_kiosk_record_id = excluded.last_kiosk_record_id,
      updated_at = now();
  elsif new.type = 'check_out' then
    insert into attendance (
      staff_id,
      date,
      status,
      check_out_time,
      check_in_method,
      kiosk_device_id,
      last_kiosk_record_id,
      marked_by
    )
    values (
      new.staff_id,
      event_date,
      'present',
      event_time,
      'kiosk',
      new.kiosk_device_id,
      new.id,
      null
    )
    on conflict (staff_id, date) do update
    set
      check_out_time = excluded.check_out_time,
      kiosk_device_id = excluded.kiosk_device_id,
      last_kiosk_record_id = excluded.last_kiosk_record_id,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_legacy_attendance on attendance_records;
create trigger trg_sync_legacy_attendance
  after insert on attendance_records
  for each row
  execute function public.sync_legacy_attendance_from_record();

-- Block all staff self check-in on legacy attendance (kiosk sync uses security definer)
create or replace function public.embedding_array_distance(a float8[], b float8[])
returns double precision
language plpgsql
immutable
as $$
declare
  i integer;
  sum_sq double precision := 0;
  len integer;
begin
  len := array_length(a, 1);
  if len is distinct from array_length(b, 1) or len is distinct from 128 then
    return null;
  end if;
  for i in 1..len loop
    sum_sq := sum_sq + power(a[i] - b[i], 2);
  end loop;
  return sqrt(sum_sq);
end;
$$;

create or replace function public.enforce_self_checkin_rules()
returns trigger
language plpgsql
as $$
begin
  if new.marked_by is not null then
    return new;
  end if;

  raise exception 'Self check-in is disabled. Use the reception kiosk to clock in or out.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: best face match distance for a staff member (server-side use)
-- ---------------------------------------------------------------------------
create or replace function public.best_face_match_distance(
  p_staff_id uuid,
  p_query float8[]
)
returns double precision
language sql
stable
security definer
set search_path = public
as $$
  select min(public.embedding_array_distance(fe.embedding_values, p_query))
  from face_embeddings fe
  where fe.staff_id = p_staff_id
    and fe.is_active = true;
$$;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'face-reference-clips',
  'face-reference-clips',
  false,
  10485760,
  array['video/webm', 'video/mp4']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kiosk-liveness-clips',
  'kiosk-liveness-clips',
  false,
  15728640,
  array['video/webm', 'video/mp4']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table kiosks enable row level security;
alter table kiosk_sessions enable row level security;
alter table face_embeddings enable row level security;
alter table attendance_records enable row level security;
alter table review_queue enable row level security;
alter table attendance_corrections enable row level security;
alter table clock_attempts enable row level security;

-- Kiosks: admins read org metadata only (never api_key_hash via view/policy filter)
drop policy if exists "Admins view org kiosks" on kiosks;
create policy "Admins view org kiosks" on kiosks
  for select to authenticated
  using (
    organization_id = public.get_my_organization_id()
    and public.is_org_admin()
  );

-- Kiosk sessions: no authenticated access (API service role only)
drop policy if exists "No direct kiosk session access" on kiosk_sessions;
create policy "No direct kiosk session access" on kiosk_sessions
  for all to authenticated
  using (false)
  with check (false);

-- Face embeddings
drop policy if exists "Staff view own face embeddings" on face_embeddings;
create policy "Staff view own face embeddings" on face_embeddings
  for select to authenticated
  using (
    staff_id = (select id from profiles where user_id = auth.uid())
  );

drop policy if exists "Admins view org face embeddings" on face_embeddings;
create policy "Admins view org face embeddings" on face_embeddings
  for select to authenticated
  using (
    organization_id = public.get_my_organization_id()
    and public.is_org_admin()
  );

-- Attendance records: staff read own; admins read org; NO staff writes
drop policy if exists "Staff view own attendance records" on attendance_records;
create policy "Staff view own attendance records" on attendance_records
  for select to authenticated
  using (
    staff_id = (select id from profiles where user_id = auth.uid())
  );

drop policy if exists "Admins view org attendance records" on attendance_records;
create policy "Admins view org attendance records" on attendance_records
  for select to authenticated
  using (
    organization_id = public.get_my_organization_id()
    and public.is_org_admin()
  );

-- Review queue: admins only
drop policy if exists "Admins manage org review queue" on review_queue;
create policy "Admins manage org review queue" on review_queue
  for all to authenticated
  using (
    organization_id = public.get_my_organization_id()
    and public.is_org_admin()
  )
  with check (
    organization_id = public.get_my_organization_id()
    and public.is_org_admin()
  );

-- Corrections & attempts: admins read org
drop policy if exists "Admins view org attendance corrections" on attendance_corrections;
create policy "Admins view org attendance corrections" on attendance_corrections
  for select to authenticated
  using (
    organization_id = public.get_my_organization_id()
    and public.is_org_admin()
  );

drop policy if exists "Admins view org clock attempts" on clock_attempts;
create policy "Admins view org clock attempts" on clock_attempts
  for select to authenticated
  using (
    organization_id = public.get_my_organization_id()
    and public.is_org_admin()
  );

-- Remove staff write access on legacy attendance
drop policy if exists "Staff insert own attendance" on attendance;
drop policy if exists "Staff update own attendance" on attendance;

-- Inserts/updates on kiosk tables and attendance_records via service role API routes only
revoke insert, update, delete on attendance_records from authenticated;
revoke insert, update, delete on face_embeddings from authenticated;
revoke insert, update, delete on review_queue from authenticated;
revoke insert, update, delete on clock_attempts from authenticated;
revoke insert, update, delete on attendance_corrections from authenticated;
revoke all on kiosk_sessions from authenticated;
revoke insert, update, delete on kiosks from authenticated;

grant select on attendance_records to authenticated;
grant select on face_embeddings to authenticated;

-- Realtime for staff dashboard live updates
do $$
begin
  alter publication supabase_realtime add table attendance_records;
exception
  when duplicate_object then null;
end $$;

-- Storage policies (staff upload own reference clips; kiosk uploads via service role)
drop policy if exists "Staff upload face reference clips" on storage.objects;
create policy "Staff upload face reference clips" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'face-reference-clips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Staff read own face reference clips" on storage.objects;
create policy "Staff read own face reference clips" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'face-reference-clips'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from profiles viewer
        join profiles owner on owner.user_id::text = (storage.foldername(name))[1]
        where viewer.user_id = auth.uid()
          and viewer.role = 'admin'
          and viewer.organization_id = owner.organization_id
      )
    )
  );

drop policy if exists "Admins read org kiosk liveness clips" on storage.objects;
create policy "Admins read org kiosk liveness clips" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kiosk-liveness-clips'
    and exists (
      select 1
      from profiles viewer
      where viewer.user_id = auth.uid()
        and viewer.role = 'admin'
        and viewer.organization_id::text = (storage.foldername(name))[1]
    )
  );

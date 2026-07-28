-- Short-lived phone clock challenges: kiosk issues QR, staff finishes face on phone.

create table if not exists phone_clock_challenges (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  organization_id uuid not null references organizations(id) on delete cascade,
  kiosk_id uuid not null references kiosks(id) on delete cascade,
  staff_id uuid not null references profiles(id) on delete cascade,
  attempt_type text not null check (attempt_type in ('check_in', 'check_out')),
  expires_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired', 'failed')),
  completed_at timestamptz,
  attendance_record_id uuid,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists phone_clock_challenges_token_idx
  on phone_clock_challenges (token);

create index if not exists phone_clock_challenges_kiosk_pending_idx
  on phone_clock_challenges (kiosk_id, status, expires_at);

alter table phone_clock_challenges enable row level security;

-- Service role only from API (no direct client policies)
drop policy if exists "No direct client access to phone challenges" on phone_clock_challenges;

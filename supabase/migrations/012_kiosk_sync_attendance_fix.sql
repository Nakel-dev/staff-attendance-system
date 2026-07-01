-- Fix: kiosk clock-in sync was blocked by enforce_self_checkin_rules
-- sync_legacy_attendance_from_record inserts attendance with marked_by = null
-- but check_in_method = 'kiosk' — must be allowed through the guard trigger.

create or replace function public.enforce_self_checkin_rules()
returns trigger
language plpgsql
as $$
begin
  -- Admin-marked or manager override
  if new.marked_by is not null then
    return new;
  end if;

  -- Kiosk sync from attendance_records (security definer trigger)
  if new.check_in_method = 'kiosk' or new.kiosk_device_id is not null then
    return new;
  end if;

  raise exception 'Self check-in is disabled. Use the reception kiosk to clock in or out.';
end;
$$;

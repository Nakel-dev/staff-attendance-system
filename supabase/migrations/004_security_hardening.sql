-- Prevent privilege escalation via profile self-updates

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.user_id then
    if new.role is distinct from old.role then
      raise exception 'You cannot change your own role';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'You cannot change your own active status';
    end if;
    if new.organization_id is distinct from old.organization_id then
      raise exception 'You cannot change your organization';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_escalation on profiles;
create trigger profiles_prevent_escalation
  before update on profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();

-- Staff can update own safe fields; trigger blocks role/status/org changes
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update using (user_id = auth.uid());

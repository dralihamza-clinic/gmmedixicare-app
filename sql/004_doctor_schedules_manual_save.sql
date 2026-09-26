-- ============================================================================
-- GMMedixicare — Working hours are saved only by staff, never automatically.
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query).
--
-- Problem this fixes: "Add Doctor" failed with
--   new row violates row-level security policy for table "doctor_schedules"
-- A trigger on public.doctors was inserting default working hours whenever a
-- doctor was created. Triggers run as the signed-in user, so that insert was
-- checked against doctor_schedules' RLS, failed the admin check, and rolled
-- back the whole doctor insert.
--
-- Default hours (9 AM – 9 PM, Friday off) are now only the editor's starting
-- state in the desktop app (WorkingHoursSection); rows are written when staff
-- click "Save hours". So:
--   1. Drop any trigger on public.doctors that writes doctor_schedules.
--   2. Make sure admins can manage doctor_schedules, so "Save hours" works.
-- Safe to run more than once.
-- ============================================================================

-- Optional: look before changing anything. Lists the triggers on doctors and
-- the policies on doctor_schedules.
--
--   select tg.tgname as trigger, p.proname as function, p.prosrc as body
--   from pg_trigger tg
--   join pg_proc p on p.oid = tg.tgfoid
--   where tg.tgrelid = 'public.doctors'::regclass and not tg.tgisinternal;
--
--   select policyname, cmd, roles, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'doctor_schedules';

-- 1. Remove automatic schedule creation -------------------------------------
-- Drops only triggers whose function mentions doctor_schedules; any other
-- trigger on doctors is left alone. The trigger function itself is kept (it
-- does nothing without the trigger) in case something else calls it.
do $$
declare
  t record;
begin
  for t in
    select tg.tgname, n.nspname, p.proname
    from pg_trigger tg
    join pg_proc p on p.oid = tg.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where tg.tgrelid = 'public.doctors'::regclass
      and not tg.tgisinternal
      and p.prosrc ilike '%doctor_schedules%'
  loop
    raise notice 'Dropping trigger % on public.doctors (function %.%)', t.tgname, t.nspname, t.proname;
    execute format('drop trigger %I on public.doctors', t.tgname);
  end loop;
end $$;

-- 2. Admins can manage working hours ------------------------------------------
-- Same admin check as "Admins can manage doctors" (sql/002). Policies are
-- permissive, so any existing read policy (e.g. the public site's) still
-- applies alongside this one.
alter table public.doctor_schedules enable row level security;

drop policy if exists "Admins can manage doctor schedules" on public.doctor_schedules;
create policy "Admins can manage doctor schedules"
  on public.doctor_schedules
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

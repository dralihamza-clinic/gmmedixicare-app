-- ============================================================================
-- GMMedixicare — Staff roles, admin write access, and future per-doctor
-- dashboard schema. Run this once in the Supabase SQL Editor, after
-- 001_doctors_schema.sql.
--
-- What this adds:
--   1. user_roles       — links a Supabase Auth user to a staff role
--                          ('admin' or 'doctor') and, for doctors, to their
--                          row in public.doctors.
--   2. Two SECURITY DEFINER helper functions (is_admin, current_doctor_id)
--      used inside RLS policies. SECURITY DEFINER avoids the classic
--      "RLS policy on user_roles queries user_roles" infinite-recursion trap.
--   3. An admin write policy on public.doctors, so the dashboard can
--      create/edit/deactivate doctors as a signed-in admin instead of via
--      the SQL editor.
--   4. patients + medical_records — stub tables for the future per-doctor
--      dashboard (patient history). Admins see everything; a doctor only
--      ever sees their own patients. No UI reads/writes these yet — they
--      exist now so the auth/role model doesn't need to be redesigned later.
-- ============================================================================

-- 1. Staff roles -----------------------------------------------------------
create table if not exists public.user_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'doctor')),
  doctor_id   uuid references public.doctors(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- A signed-in user may read their own role row (the app uses this to decide
-- which dashboard to show). Nobody can write to this table via the API —
-- assign roles from the Supabase dashboard's Table Editor, or the
-- service_role key from a trusted server context. Keeping writes out of
-- anon/authenticated reach means a compromised session can't self-promote
-- to admin.
drop policy if exists "Users can view their own role" on public.user_roles;
create policy "Users can view their own role"
  on public.user_roles
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 2. Helper functions (SECURITY DEFINER — bypasses RLS internally so these
-- can be safely called *from inside* other tables' RLS policies without
-- recursion) ----------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.current_doctor_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select doctor_id from public.user_roles
  where user_id = auth.uid() and role = 'doctor';
$$;

-- 3. Admins can fully manage the doctors table -------------------------------
drop policy if exists "Admins can manage doctors" on public.doctors;
create policy "Admins can manage doctors"
  on public.doctors
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Signed-in users can view active doctors" on public.doctors;
create policy "Signed-in users can view active doctors"
  on public.doctors
  for select
  to authenticated
  using (active = true);

-- 4. Future per-doctor dashboard: patients + medical records -----------------
create table if not exists public.patients (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null,
  date_of_birth      date,
  phone              text,
  email              text,
  primary_doctor_id  uuid references public.doctors(id),
  notes              text,
  created_at         timestamptz not null default now()
);

alter table public.patients enable row level security;

drop policy if exists "Admins can manage patients" on public.patients;
create policy "Admins can manage patients"
  on public.patients
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Doctors can view their own patients" on public.patients;
create policy "Doctors can view their own patients"
  on public.patients
  for select
  to authenticated
  using (primary_doctor_id = public.current_doctor_id());

create table if not exists public.medical_records (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id) on delete cascade,
  doctor_id    uuid not null references public.doctors(id),
  visit_date   date not null default current_date,
  diagnosis    text,
  notes        text,
  prescription text,
  created_at   timestamptz not null default now()
);

alter table public.medical_records enable row level security;

drop policy if exists "Admins can manage medical records" on public.medical_records;
create policy "Admins can manage medical records"
  on public.medical_records
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Doctors can view their own patients' records" on public.medical_records;
create policy "Doctors can view their own patients' records"
  on public.medical_records
  for select
  to authenticated
  using (doctor_id = public.current_doctor_id());

drop policy if exists "Doctors can add records for their own patients" on public.medical_records;
create policy "Doctors can add records for their own patients"
  on public.medical_records
  for insert
  to authenticated
  with check (
    doctor_id = public.current_doctor_id()
    and exists (
      select 1 from public.patients p
      where p.id = patient_id
        and p.primary_doctor_id = public.current_doctor_id()
    )
  );

-- ============================================================================
-- After running this: create your first admin account.
--   1. Supabase dashboard -> Authentication -> Add user (or have them sign
--      up via /login once you build a sign-up flow — none exists yet, this
--      site provisions staff manually on purpose).
--   2. Table Editor -> user_roles -> Insert row:
--        user_id = the new user's id (from Authentication -> Users)
--        role    = 'admin'
--        doctor_id = null
--   3. To give a doctor their own future dashboard, insert a row with
--      role = 'doctor' and doctor_id = their row in public.doctors.
-- ============================================================================

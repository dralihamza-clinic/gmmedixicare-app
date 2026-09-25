-- ============================================================================
-- GmMedixicare — Doctors table schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================================

-- 1. Table --------------------------------------------------------------
create table if not exists public.doctors (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  profile_picture       text,                 -- URL to the doctor's photo
  qualifications        text,                 -- e.g. "MBBS, FCPS"
  specialization        text,                 -- e.g. "Cardiologist"
  experience             text,                -- e.g. "8+ years" (free text, keeps it flexible)
  bio                   text,
  consultation_fee      numeric(10, 2),
  availability          text,                 -- e.g. "Mon–Fri, 10am–4pm"
  telemedicine_enabled  boolean not null default false,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

-- 2. Row Level Security ---------------------------------------------------
alter table public.doctors enable row level security;

-- Public (anon) visitors may only READ doctors marked active.
-- This is what the homepage carousel and profile page use.
drop policy if exists "Public can view active doctors" on public.doctors;
create policy "Public can view active doctors"
  on public.doctors
  for select
  to anon
  using (active = true);

-- No insert/update/delete policy is created for the anon role on purpose.
-- The future admin dashboard should write using an authenticated role
-- (e.g. Supabase Auth + a policy scoped to authenticated admins, or the
-- service_role key from a trusted server-side context) — never the public
-- anon key used in this static site's client-side JS.

-- 3. Sample seed data (optional — safe to skip or edit) -------------------
insert into public.doctors
  (name, profile_picture, qualifications, specialization, experience, bio, consultation_fee, availability, telemedicine_enabled, active)
values
  ('Dr. Ali Hamza', 'https://randomuser.me/api/portraits/men/32.jpg', 'MBBS', 'Chief Medical Officer',
   '5+ years', 'Dr. Ali Hamza brings over 5 years of clinical leadership to GmMedixicare. His vision integrates rigorous, evidence-based medicine with an unwavering commitment to holistic patient well-being.',
   50.00, 'Mon–Sat, 9:30am–6:00pm', true, true),

  ('Dr. Sara Khan', 'https://randomuser.me/api/portraits/women/44.jpg', 'MBBS, FCPS', 'General Physician',
   '8+ years', '8+ years treating families with a calm, thorough approach to everyday care.',
   30.00, 'Mon–Sat, 10:00am–5:00pm', true, true),

  ('Dr. Meryam Batool', 'https://randomuser.me/api/portraits/women/68.jpg', 'MBBS', 'Pediatrics',
   '6+ years', 'Gentle, attentive care for infants, children, and growing families.',
   35.00, 'Mon–Fri, 9:00am–4:00pm', true, true),

  ('Dr. Bilal Ahmed', 'https://randomuser.me/api/portraits/men/76.jpg', 'MBBS, FCPS', 'Cardiologist',
   '10+ years', 'Specializes in preventive cardiology and long-term heart health plans.',
   60.00, 'Tue & Thu, 11:00am–3:00pm', false, true),

  ('Dr. Ayesha Malik', 'https://randomuser.me/api/portraits/women/22.jpg', 'BDS', 'Dental Surgeon',
   '7+ years', 'Comprehensive dental care from routine cleanings to cosmetic work.',
   25.00, 'Mon–Sat, 10:00am–6:00pm', false, true),

  ('Dr. Usman Tariq', 'https://randomuser.me/api/portraits/men/54.jpg', 'DPT', 'Physiotherapist',
   '5+ years', 'Helps patients recover mobility through personalized rehab programs.',
   20.00, 'Mon–Fri, 8:00am–2:00pm', true, true);

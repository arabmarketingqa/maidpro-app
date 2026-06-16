-- ============================================================
-- Maid Pro — Full Supabase Setup
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Drop all old tables (safe cascade)
drop table if exists public.bookings cascade;
drop table if exists public.staff cascade;
drop table if exists public.nationalities cascade;

-- ============================================================
-- 2. bookings table
-- ============================================================
create table public.bookings (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  ref         text unique,
  name        text,
  phone       text,
  service     text,
  mode        text default 'hourly',
  date        date,
  time        text,
  area        text default '',
  hours       integer default 0,
  cleaners    integer default 1,
  materials   boolean default false,
  rate        numeric default 0,
  total       numeric default 0,
  address     text default '',
  notes       text default '',
  status      text default 'New'
);

alter table public.bookings enable row level security;
create policy "anon_insert_bookings"  on public.bookings for insert to anon with check (true);
create policy "anon_select_bookings"  on public.bookings for select to anon using (true);
create policy "anon_update_bookings"  on public.bookings for update to anon using (true) with check (true);

-- ============================================================
-- 3. nationalities table
-- ============================================================
create table public.nationalities (
  id      text primary key,
  name    text not null,
  flag    text,
  rate    numeric default 15,
  enabled boolean default true
);

alter table public.nationalities enable row level security;
create policy "anon_all_nationalities" on public.nationalities
  for all to anon using (true) with check (true);

insert into public.nationalities (id, name, flag, rate, enabled) values
  ('philippines', 'Philippines', '🇵🇭', 40, true),
  ('indian',      'Indian',      '🇮🇳', 25, true),
  ('nepal',       'Nepal',       '🇳🇵', 20, true),
  ('nigeria',     'Nigeria',     '🇳🇬', 15, true);

-- ============================================================
-- 4. staff table
-- ============================================================
create table public.staff (
  id          text primary key,
  name        text not null,
  nationality text default 'philippines',
  status      text default 'Available',
  color       text default 'mint',
  skills      text[] default '{}',
  phone       text default '',
  notes       text default '',
  created_at  timestamptz default now()
);

alter table public.staff enable row level security;
create policy "anon_all_staff" on public.staff
  for all to anon using (true) with check (true);

insert into public.staff (id, name, nationality, status, color, skills) values
  ('s1', 'Maria Santos',   'philippines', 'Available', 'mint',   '{"regular","deep","movein"}'),
  ('s2', 'Anjali Sharma',  'indian',      'Busy',      'sky',    '{"regular","deep"}'),
  ('s3', 'Wendy Cruz',     'philippines', 'Available', 'pink',   '{"regular","deep","post"}'),
  ('s4', 'Amy Thapa',      'nepal',       'Available', 'amber',  '{"regular","movein"}'),
  ('s5', 'Michael Okafor', 'nigeria',     'On-Leave',  'violet', '{"regular","post"}'),
  ('s6', 'John Reyes',     'philippines', 'Available', 'sky',    '{"regular","deep","movein","post"}'),
  ('s7', 'Priya Gurung',   'nepal',       'Busy',      'mint',   '{"regular","deep"}'),
  ('s8', 'Roselle Tan',    'philippines', 'Available', 'pink',   '{"regular","deep","post"}');

-- ============================================================
-- Done! 3 tables created with RLS + seed data.
-- ============================================================

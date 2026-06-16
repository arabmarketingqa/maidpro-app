-- ============================================================
-- Maid Pro v2 — Full Admin Panel Setup
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Extend bookings table
alter table public.bookings add column if not exists mode text default 'hourly';
alter table public.bookings add column if not exists assigned_staff text[] default '{}';

-- 2. Settings table (key → jsonb value)
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null default '{}'
);
alter table public.settings enable row level security;
drop policy if exists "anon_all_settings" on public.settings;
create policy "anon_all_settings" on public.settings
  for all to anon using (true) with check (true);

-- Seed default settings (won't overwrite if already set)
insert into public.settings (key, value) values
  ('services',       '[{"id":"regular","name":"Regular Cleaning","emoji":"🧹","rate":15,"on":true},{"id":"deep","name":"Deep Cleaning","emoji":"✨","rate":18,"on":true},{"id":"movein","name":"Move-in / Out","emoji":"📦","rate":20,"on":true},{"id":"post","name":"Post-Construction","emoji":"🏗️","rate":25,"on":false}]'),
  ('limits',         '{"minHours":3,"maxMaids":4,"maxHours":12,"leadHours":1,"cancelHours":6,"radiusKm":30}'),
  ('modes',          '[{"id":"hourly","name":"Hourly Booking","emoji":"⏱️","desc":"On-demand cleaning, billed by the hour.","on":true},{"id":"monthly","name":"Monthly Plans","emoji":"📅","desc":"Recurring weekly cleaning packages.","on":true},{"id":"stayin","name":"Stay-In","emoji":"🏠","desc":"Long-term live-in maid contracts.","on":true}]'),
  ('monthly',        '[{"id":"basic","name":"Basic Package","emoji":"🌿","maids":1,"daysPerWeek":4,"hoursPerDay":4,"priceMonthly":960,"discountLabel":""},{"id":"standard","name":"Standard Package","emoji":"⭐","maids":1,"daysPerWeek":5,"hoursPerDay":4,"priceMonthly":1200,"discountLabel":"MOST POPULAR"},{"id":"premium","name":"Premium Package","emoji":"👑","maids":2,"daysPerWeek":5,"hoursPerDay":4,"priceMonthly":2400,"discountLabel":""}]'),
  ('monthlySettings','{"autoRenew":true,"noticeDays":14,"minMonths":1,"allowSkip":true,"freeReschedule":2}'),
  ('stayIn',         '[{"id":"si1","name":"1 Month","months":1,"price":5500,"save":0,"notes":"Includes accommodation & food allowance."},{"id":"si3","name":"3 Months","months":3,"price":15000,"save":1500,"notes":"Best for short contracts. Save 1,500 QAR."},{"id":"si6","name":"6 Months","months":6,"price":28500,"save":4500,"notes":"Visa processing included."},{"id":"si12","name":"12 Months","months":12,"price":54000,"save":12000,"notes":"Full annual contract — visa, insurance, end-of-service benefits."}]'),
  ('stayinSettings', '{"visa":true,"accommodation":true,"food":true,"deposit":1,"probationDays":14,"replaceWindow":30}'),
  ('materials',      '{"rate":10,"enabled":true,"items":["Microfibre mop & bucket","All-purpose detergent","Glass cleaner","Bathroom disinfectant","Floor cleaner (eco-friendly)","Microfibre cloths (×6)","Sponges & scrub pads","Heavy-duty trash bags"]}'),
  ('brand',          '{"name":"Maid Pro","phone":"+974 4400 1188","currency":"QAR","timezone":"Asia/Qatar (GMT+3)"}'),
  ('bookingRules',   '{"autoConfirm":true,"smsReminders":true,"guestCheckout":false,"idVerification":true,"noShowFee":false,"maidPhotos":true,"autoAssign":true}')
on conflict (key) do nothing;

-- 3. Availability table (blocked dates)
create table if not exists public.availability (
  date      date primary key,
  blocked   boolean default false,
  morning   boolean default true,
  afternoon boolean default true
);
alter table public.availability enable row level security;
drop policy if exists "anon_all_availability" on public.availability;
create policy "anon_all_availability" on public.availability
  for all to anon using (true) with check (true);

-- Done!

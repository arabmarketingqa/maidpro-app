-- Add assigned_staff column to bookings (safe to run multiple times)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS assigned_staff text[] DEFAULT '{}';

-- Migration: add payment tracking columns to bookings
-- Safe to run multiple times (IF NOT EXISTS guards every statement)

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS paid_amount    NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT          DEFAULT NULL;

-- Back-fill any NULLs so (total - paid_amount) never returns NULL
UPDATE public.bookings
  SET paid_amount = 0
  WHERE paid_amount IS NULL;

-- Tell PostgREST to reload its schema cache immediately
-- (avoids the "column not found in schema cache" error)
NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════
-- Fix Payment System
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run multiple times (uses IF NOT EXISTS / DO NOTHING).
-- ════════════════════════════════════════════════════════════════════

-- 1. Add payment columns to bookings (the original schema was missing them)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_amount    NUMERIC(10,2) DEFAULT 0;

-- 2. Make sure no existing rows have NULL (would break subtraction math)
UPDATE bookings SET paid_amount = 0 WHERE paid_amount IS NULL;

-- 3. Quick sanity check — run this after the above to confirm columns exist:
-- SELECT ref, total, paid_amount, (total - paid_amount) AS due FROM bookings LIMIT 5;

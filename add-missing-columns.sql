-- Migration: Add all missing columns to the bookings table
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS ref         TEXT,
  ADD COLUMN IF NOT EXISTS name        TEXT,
  ADD COLUMN IF NOT EXISTS phone       TEXT,
  ADD COLUMN IF NOT EXISTS service     TEXT,
  ADD COLUMN IF NOT EXISTS date        DATE,
  ADD COLUMN IF NOT EXISTS time        TEXT,
  ADD COLUMN IF NOT EXISTS area        TEXT,
  ADD COLUMN IF NOT EXISTS hours       INTEGER     DEFAULT 4,
  ADD COLUMN IF NOT EXISTS cleaners    INTEGER     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS materials   BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS rate        NUMERIC(10,2) DEFAULT 15,
  ADD COLUMN IF NOT EXISTS total       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS address     TEXT,
  ADD COLUMN IF NOT EXISTS lat         TEXT,
  ADD COLUMN IF NOT EXISTS lng         TEXT,
  ADD COLUMN IF NOT EXISTS notes       TEXT,
  ADD COLUMN IF NOT EXISTS status      TEXT        DEFAULT 'New',
  ADD COLUMN IF NOT EXISTS maid        TEXT,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();

-- Add unique constraint on ref if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_ref_key' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_ref_key UNIQUE (ref);
  END IF;
END $$;

-- Add status check constraint if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_status_check' AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
      CHECK (status IN ('New','Confirmed','Completed','Cancelled'));
  END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_bookings_date   ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_phone  ON bookings(phone);

-- Ensure RLS is enabled and policy exists
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bookings' AND policyname = 'allow_all_bookings'
  ) THEN
    CREATE POLICY "allow_all_bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

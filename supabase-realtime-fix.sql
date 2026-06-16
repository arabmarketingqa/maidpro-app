-- Enable realtime for settings and availability tables
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add settings table to realtime publication
-- (needed for customer booking page to receive live mode toggle updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  END IF;
END $$;

-- 2. Add availability table to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'availability'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.availability;
  END IF;
END $$;

-- 3. Verify current modes state
SELECT key, value FROM public.settings WHERE key = 'modes';

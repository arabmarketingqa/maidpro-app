-- ── Run this in Supabase SQL Editor ──────────────────────────────────────

-- 1. Nationalities table
CREATE TABLE IF NOT EXISTS nationalities (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  flag       TEXT NOT NULL DEFAULT '🌍',
  rate       NUMERIC(10,2) NOT NULL DEFAULT 15,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nationalities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nationalities' AND policyname='allow_all_nationalities') THEN
    CREATE POLICY "allow_all_nationalities" ON nationalities FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default nationalities (safe to re-run)
INSERT INTO nationalities (id, name, flag, rate, enabled) VALUES
  ('philippines', 'Philippines', '🇵🇭', 40, true),
  ('indian',      'Indian',      '🇮🇳', 25, true),
  ('nepal',       'Nepal',       '🇳🇵', 20, true),
  ('nigeria',     'Nigeria',     '🇳🇬', 15, false)
ON CONFLICT (id) DO NOTHING;


-- 2. Staff table — add missing columns if needed
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS skills JSONB    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS color  TEXT     NOT NULL DEFAULT 'mint',
  ADD COLUMN IF NOT EXISTS phone  TEXT     DEFAULT '';

-- Fix status constraint to match the UI values
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_status_check;
ALTER TABLE staff ADD CONSTRAINT staff_status_check
  CHECK (status IN ('Available', 'Busy', 'On-Leave'));

-- Update old On-Duty → Busy, Leave → On-Leave if you had seed data
UPDATE staff SET status = 'Busy'     WHERE status = 'On-Duty';
UPDATE staff SET status = 'On-Leave' WHERE status = 'Leave';

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='allow_all_staff') THEN
    CREATE POLICY "allow_all_staff" ON staff FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default staff (safe to re-run)
INSERT INTO staff (id, name, nationality, status, color, skills) VALUES
  ('s1', 'Maria Santos',   'philippines', 'Available', 'mint',   '["regular","deep","movein"]'),
  ('s2', 'Anjali Sharma',  'indian',      'Busy',      'sky',    '["regular","deep"]'),
  ('s3', 'Wendy Cruz',     'philippines', 'Available', 'pink',   '["regular","deep","post"]'),
  ('s4', 'Amy Thapa',      'nepal',       'Available', 'amber',  '["regular","movein"]'),
  ('s5', 'Michael Okafor', 'nigeria',     'On-Leave',  'violet', '["regular","post"]')
ON CONFLICT (id) DO NOTHING;

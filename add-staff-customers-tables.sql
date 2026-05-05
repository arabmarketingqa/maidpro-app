-- Migration: Create staff and customers tables
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  phone        TEXT,
  nationality  TEXT,
  status       TEXT NOT NULL DEFAULT 'Available'
                 CHECK (status IN ('Available','On-Duty','Leave')),
  color        TEXT NOT NULL DEFAULT '#0d9488',
  join_date    DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  area        TEXT,
  address     TEXT,
  email       TEXT,
  notes       TEXT,
  tag         TEXT NOT NULL DEFAULT 'new'
                CHECK (tag IN ('vip','loyal','new','regular','inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE staff     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='allow_all_staff') THEN
    CREATE POLICY "allow_all_staff" ON staff FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='allow_all_customers') THEN
    CREATE POLICY "allow_all_customers" ON customers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default staff (Nelly, Ivon, Fiona, Nasra, Fiona B)
INSERT INTO staff (id, name, phone, nationality, status, color, notes) VALUES
  ('s1', 'Nelly',   '', '', 'Available', '#0d9488', ''),
  ('s2', 'Ivon',    '', '', 'Available', '#3b82f6', ''),
  ('s3', 'Fiona',   '', '', 'Available', '#8b5cf6', ''),
  ('s4', 'Nasra',   '', '', 'Available', '#f59e0b', ''),
  ('s5', 'Fiona B', '', '', 'Available', '#ef4444', '')
ON CONFLICT (id) DO NOTHING;

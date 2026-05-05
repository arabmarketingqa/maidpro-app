-- CleanPro Maid Booking System — Supabase Schema
-- Run this in the Supabase SQL Editor

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  service     TEXT NOT NULL,
  date        DATE NOT NULL,
  time        TEXT NOT NULL,
  area        TEXT,
  hours       INTEGER NOT NULL DEFAULT 4,
  cleaners    INTEGER NOT NULL DEFAULT 1,
  materials   BOOLEAN NOT NULL DEFAULT false,
  rate        NUMERIC(10,2) NOT NULL DEFAULT 15,
  total       NUMERIC(10,2) NOT NULL,
  address     TEXT,
  lat         TEXT,
  lng         TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'New'
                CHECK (status IN ('New','Confirmed','Completed','Cancelled')),
  maid        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Customers table (manually added / enriched records)
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

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bookings_date   ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_phone  ON bookings(phone);

-- Enable Row Level Security (public read/write via anon key for simplicity)
-- In production you would restrict this further
ALTER TABLE bookings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_bookings"  ON bookings  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_staff"     ON staff     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_customers" ON customers FOR ALL USING (true) WITH CHECK (true);

-- Seed default staff
INSERT INTO staff (id, name, phone, nationality, status, color, notes) VALUES
  ('s1', 'Nelly',   '', '', 'Available', '#0d9488', ''),
  ('s2', 'Ivon',    '', '', 'Available', '#3b82f6', ''),
  ('s3', 'Fiona',   '', '', 'Available', '#8b5cf6', ''),
  ('s4', 'Nasra',   '', '', 'Available', '#f59e0b', ''),
  ('s5', 'Fiona B', '', '', 'Available', '#ef4444', '')
ON CONFLICT (id) DO NOTHING;

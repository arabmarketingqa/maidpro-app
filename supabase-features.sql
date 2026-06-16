-- ─────────────────────────────────────────────────────────────────────────────
-- Feature migrations for Maid Pro
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- All statements are idempotent (safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Feature 1: Per-maid hour splits ──────────────────────────────────────────
-- Stores { "staffId": hoursFloat, ... } — drives sequential calendar slots
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS staff_hours JSONB DEFAULT '{}';

-- ── Feature 2: Regular customer recurring schedules ───────────────────────────
CREATE TABLE IF NOT EXISTS regular_schedules (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT,                        -- optional FK to customers.id
  customer_name   TEXT        NOT NULL,
  customer_phone  TEXT        NOT NULL,
  service         TEXT        NOT NULL DEFAULT 'Regular Cleaning',
  nationality     TEXT        NOT NULL DEFAULT '',
  days_of_week    INTEGER[]   NOT NULL DEFAULT '{}',   -- JS getDay() convention: 0=Sun…6=Sat
  start_time      TEXT        NOT NULL DEFAULT '9:00 AM',
  hours           INTEGER     NOT NULL DEFAULT 4,
  maids           INTEGER     NOT NULL DEFAULT 1,
  assigned_staff  TEXT[]               DEFAULT '{}',
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  notes           TEXT                 DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_regular_schedules_phone  ON regular_schedules (customer_phone);
CREATE INDEX IF NOT EXISTS idx_regular_schedules_active ON regular_schedules (active);
CREATE INDEX IF NOT EXISTS idx_bookings_staff_hours     ON bookings USING GIN (staff_hours);

-- ── Feature 3: Schedule type (weekly / monthly) ───────────────────────────────
-- These columns extend regular_schedules to support date-of-month scheduling.
-- Safe to run even if regular_schedules already exists.
ALTER TABLE regular_schedules
  ADD COLUMN IF NOT EXISTS schedule_type TEXT        NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS monthly_dates INTEGER[]   NOT NULL DEFAULT '{}';

-- RLS: allow anon reads/writes (same policy as your other tables)
ALTER TABLE regular_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "anon_all_regular_schedules"
  ON regular_schedules FOR ALL TO anon USING (true) WITH CHECK (true);

-- Reload PostgREST so all new columns are immediately queryable
NOTIFY pgrst, 'reload schema';

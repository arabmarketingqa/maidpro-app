-- ─────────────────────────────────────────────────────────────────────────────
-- Performance indexes for the Maid Pro booking page
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- All statements are idempotent (safe to run multiple times).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Bookings: date look-up is the hottest query (slot availability per day)
CREATE INDEX IF NOT EXISTS idx_bookings_date
  ON bookings (date);

-- 2. Bookings: status filter applied on every slot query
CREATE INDEX IF NOT EXISTS idx_bookings_date_status
  ON bookings (date, status);

-- 3. Nationalities: enabled filter used on every page load
CREATE INDEX IF NOT EXISTS idx_nationalities_enabled
  ON nationalities (enabled);

-- 4. Staff: status filter used for availability and assignment queries
CREATE INDEX IF NOT EXISTS idx_staff_status
  ON staff (status);

-- 5. Staff: nationality + status used together for nat-blocking filter
CREATE INDEX IF NOT EXISTS idx_staff_status_nationality
  ON staff (status, nationality);

-- 6. Settings: key is already the primary key — no extra index needed.
--    (settings table uses key TEXT PRIMARY KEY, so lookups are O(log n))

-- 7. Availability: date is used in look-ups (already likely PK, but add if not)
CREATE INDEX IF NOT EXISTS idx_availability_date
  ON availability (date);


-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL — Consolidation RPC (reduces 2 parallel queries to 1 round-trip)
-- Uncomment and run to enable; the app will use it automatically on next deploy.
-- ─────────────────────────────────────────────────────────────────────────────

/*
CREATE OR REPLACE FUNCTION public.get_booking_page_data()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'settings', (
      SELECT jsonb_object_agg(key, value)
      FROM settings
      WHERE key IN (
        'modes','nationalities_block','services','monthly',
        'stayIn','limits','materials','businessHours','brand'
      )
    ),
    'nationalities', (
      SELECT jsonb_agg(row_to_json(n) ORDER BY n.name)
      FROM nationalities n
      WHERE enabled IS NOT DISTINCT FROM TRUE
    )
  )
$$;

-- Grant anon access so the browser client can call it
GRANT EXECUTE ON FUNCTION public.get_booking_page_data() TO anon;
*/

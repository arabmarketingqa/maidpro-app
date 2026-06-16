#!/usr/bin/env node
/**
 * Creates the regular_schedules table and adds the staff_hours column to bookings.
 *
 * Requires ONE line in your .env:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxx
 *
 *   Get yours at: https://supabase.com/dashboard/account/tokens
 *   Account → Access Tokens → "Generate new token"
 *
 * Usage:
 *   node scripts/run-features-migration.js
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq === -1) return;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k && !(k in process.env)) process.env[k] = v;
  });
}
loadEnv();

const PROJECT_REF  = 'krijpvoonlpwxinohthb';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const SQL = `
-- 1. Add staff_hours JSONB column to bookings (stores per-maid hour splits)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS staff_hours JSONB NOT NULL DEFAULT '{}';

-- 2. Create the regular_schedules table
CREATE TABLE IF NOT EXISTS public.regular_schedules (
  id              TEXT         NOT NULL PRIMARY KEY,
  customer_id     TEXT,
  customer_name   TEXT         NOT NULL,
  customer_phone  TEXT         NOT NULL,
  service         TEXT         NOT NULL DEFAULT 'Regular Cleaning',
  nationality     TEXT         NOT NULL DEFAULT '',
  days_of_week    INTEGER[]    NOT NULL DEFAULT '{}',
  start_time      TEXT         NOT NULL DEFAULT '9:00 AM',
  hours           INTEGER      NOT NULL DEFAULT 4,
  maids           INTEGER      NOT NULL DEFAULT 1,
  assigned_staff  TEXT[]                DEFAULT '{}',
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  notes           TEXT                  DEFAULT '',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_regular_schedules_phone  ON public.regular_schedules (customer_phone);
CREATE INDEX IF NOT EXISTS idx_regular_schedules_active ON public.regular_schedules (active);

-- 4. Enable Row Level Security
ALTER TABLE public.regular_schedules ENABLE ROW LEVEL SECURITY;

-- 5. RLS policy: allow anon full access (same as other tables in this project)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'regular_schedules'
      AND policyname = 'anon_all_regular_schedules'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY anon_all_regular_schedules
        ON public.regular_schedules
        FOR ALL TO anon
        USING (true)
        WITH CHECK (true)
    $pol$;
  END IF;
END$$;

-- 6. Reload PostgREST schema cache so the new table is visible immediately
NOTIFY pgrst, 'reload schema';
`;

if (!ACCESS_TOKEN) {
  console.error('\n❌  SUPABASE_ACCESS_TOKEN is missing from your .env\n');
  console.error('   To run automatically:');
  console.error('   1. Go to  https://supabase.com/dashboard/account/tokens');
  console.error('   2. Click "Generate new token", name it "Maid Pro", copy it');
  console.error('   3. Add to .env:  SUPABASE_ACCESS_TOKEN=sbp_...');
  console.error('   4. Run:          node scripts/run-features-migration.js\n');
  console.error('   ── OR paste this SQL directly in Supabase Dashboard → SQL Editor ──\n');
  console.error(SQL);
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runQuery(label, query) {
  const res  = await fetch(API, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    const msg = JSON.stringify(json);
    if (msg.includes('already exists')) {
      console.log(`⚠️   ${label} — already exists, skipping`);
      return json;
    }
    console.error(`❌  ${label} failed (HTTP ${res.status}):`, json);
    process.exit(1);
  }
  console.log(`✅  ${label}`);
  return json;
}

(async () => {
  console.log('\n🔧  Maid Pro — features migration (regular_schedules + staff_hours)\n');

  await runQuery(
    'Add staff_hours column to bookings',
    `ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS staff_hours JSONB NOT NULL DEFAULT '{}';`
  );

  await runQuery(
    'Create regular_schedules table',
    `CREATE TABLE IF NOT EXISTS public.regular_schedules (
      id             TEXT         NOT NULL PRIMARY KEY,
      customer_id    TEXT,
      customer_name  TEXT         NOT NULL,
      customer_phone TEXT         NOT NULL,
      service        TEXT         NOT NULL DEFAULT 'Regular Cleaning',
      nationality    TEXT         NOT NULL DEFAULT '',
      days_of_week   INTEGER[]    NOT NULL DEFAULT '{}',
      start_time     TEXT         NOT NULL DEFAULT '9:00 AM',
      hours          INTEGER      NOT NULL DEFAULT 4,
      maids          INTEGER      NOT NULL DEFAULT 1,
      assigned_staff TEXT[]                DEFAULT '{}',
      active         BOOLEAN      NOT NULL DEFAULT TRUE,
      notes          TEXT                  DEFAULT '',
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );`
  );

  await runQuery(
    'Create phone index',
    `CREATE INDEX IF NOT EXISTS idx_regular_schedules_phone ON public.regular_schedules (customer_phone);`
  );

  await runQuery(
    'Create active index',
    `CREATE INDEX IF NOT EXISTS idx_regular_schedules_active ON public.regular_schedules (active);`
  );

  await runQuery(
    'Enable RLS',
    `ALTER TABLE public.regular_schedules ENABLE ROW LEVEL SECURITY;`
  );

  await runQuery(
    'Create anon RLS policy',
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='regular_schedules' AND policyname='anon_all_regular_schedules') THEN
         EXECUTE $pol$ CREATE POLICY anon_all_regular_schedules ON public.regular_schedules FOR ALL TO anon USING (true) WITH CHECK (true) $pol$;
       END IF;
     END$$;`
  );

  await runQuery(
    'Add schedule_type column',
    `ALTER TABLE public.regular_schedules ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'weekly';`
  );

  await runQuery(
    'Add monthly_dates column',
    `ALTER TABLE public.regular_schedules ADD COLUMN IF NOT EXISTS monthly_dates INTEGER[] NOT NULL DEFAULT '{}';`
  );

  await runQuery(
    'Reload PostgREST schema cache',
    `NOTIFY pgrst, 'reload schema';`
  );

  // Verify
  const rows = await runQuery(
    'Verify table exists',
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'regular_schedules'
     ORDER BY ordinal_position;`
  );

  if (Array.isArray(rows) && rows.length > 0) {
    console.log('\n📋  regular_schedules columns:');
    rows.forEach(r => console.log(`   • ${r.column_name}  (${r.data_type})`));
    console.log('\n🎉  Done. Reload the admin panel — the Regulars tab will work immediately.\n');
  } else {
    console.warn('\n⚠️   Table may not have been created — check Supabase dashboard.\n');
  }
})();

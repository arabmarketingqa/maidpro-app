#!/usr/bin/env node
/**
 * Runs the add-payment-columns migration against Supabase and
 * immediately reloads the PostgREST schema cache.
 *
 * Requirements — add ONE line to your .env:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxx
 *
 *   Get yours at:
 *     https://supabase.com/dashboard/account/tokens
 *     Account → Access Tokens → Generate new token
 *
 * Usage:
 *   node scripts/run-payment-migration.js
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse .env manually (no dotenv dependency)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    });
}

loadEnv();

const PROJECT_REF  = 'krijpvoonlpwxinohthb';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', 'add-payment-columns.sql'),
    'utf8'
  );
  console.error('\n❌  SUPABASE_ACCESS_TOKEN is missing from your .env\n');
  console.error('   Steps to run automatically:');
  console.error('   1. Go to https://supabase.com/dashboard/account/tokens');
  console.error('   2. Click "Generate new token", copy it');
  console.error('   3. Add to .env:  SUPABASE_ACCESS_TOKEN=sbp_...\n');
  console.error('   ── OR paste this SQL in Supabase Dashboard → SQL Editor ──\n');
  console.error(sql);
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runQuery(label, query) {
  const res = await fetch(API, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ query }),
  });

  let json;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    const msg = JSON.stringify(json);
    if (msg.includes('already exists')) {
      console.log(`⚠️   ${label} — column already exists, skipping`);
      return json;
    }
    console.error(`❌  ${label} failed (HTTP ${res.status}):`, json);
    process.exit(1);
  }

  console.log(`✅  ${label}`);
  return json;
}

(async () => {
  console.log('\n🔧  Maid Pro — add-payment-columns migration\n');

  await runQuery(
    'Add paid_amount + payment_method columns',
    `ALTER TABLE public.bookings
       ADD COLUMN IF NOT EXISTS paid_amount    NUMERIC(10,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS payment_method TEXT          DEFAULT NULL;`
  );

  await runQuery(
    'Back-fill NULLs → 0',
    `UPDATE public.bookings SET paid_amount = 0 WHERE paid_amount IS NULL;`
  );

  await runQuery(
    'Reload PostgREST schema cache',
    `NOTIFY pgrst, 'reload schema';`
  );

  const rows = await runQuery(
    'Verify columns exist',
    `SELECT column_name, data_type, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'bookings'
       AND column_name  IN ('paid_amount', 'payment_method')
     ORDER BY column_name;`
  );

  if (Array.isArray(rows) && rows.length >= 1) {
    console.log('\n📋  Confirmed in bookings table:');
    rows.forEach(r =>
      console.log(`   • ${r.column_name}  (${r.data_type}, default: ${r.column_default ?? 'null'})`)
    );
    console.log('\n🎉  Done. The booking modal payment fields will now save correctly.\n');
  } else {
    console.warn('\n⚠️   Verify in Supabase dashboard that the columns were created.\n');
  }
})();

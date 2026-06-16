#!/usr/bin/env node
/**
 * Deletes future "ghost" bookings — auto-generated recurring slots that no
 * longer match a schedule's current days_of_week / monthly_dates.
 *
 * Uses the project anon key (already in .env) — no PAT required.
 * The bookings table RLS policy allows DELETE for the anon role.
 *
 * Matching covers BOTH booking formats:
 *   • New:    notes starts with  [sch:<scheduleId>]
 *   • Legacy: notes contains "Recurring" (any case) with no [sch:] tag
 *
 * Usage:
 *   node scripts/cleanup-ghost-bookings.js
 *   node scripts/cleanup-ghost-bookings.js --dry-run   (preview only, no deletes)
 */

import { createClient } from '@supabase/supabase-js';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN   = process.argv.includes('--dry-run');

// ── Load .env ─────────────────────────────────────────────────────────────────
function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://krijpvoonlpwxinohthb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaWpwdm9vbmxwd3hpbm9odGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MjY4NTIsImV4cCI6MjA5MzQwMjg1Mn0.Dm7hUBswMT-kqF7gzgsOQIP9OOZpH9yYrEHyYFQJ-UI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────
const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isRecurringFor = (notes, scheduleId) => {
  const n = notes || '';
  if (n.startsWith(`[sch:${scheduleId}]`)) return true;          // precise match
  if (/recurring/i.test(n) && !/^\[sch:/.test(n)) return true;   // legacy fallback
  return false;
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧹  Maid Pro — ghost booking cleanup ${DRY_RUN ? '(DRY RUN — no changes)' : ''}\n`);

  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = ymd(today);

  // 1. Fetch every active regular schedule
  const { data: schedules, error: schErr } = await supabase
    .from('regular_schedules')
    .select('*')
    .eq('active', true);

  if (schErr) {
    // Table doesn't exist yet — nothing to clean up
    if (schErr.code === '42P01' || schErr.message?.includes('does not exist')) {
      console.log('ℹ️   regular_schedules table not found — run supabase-features.sql first.\n');
      return;
    }
    console.error('❌  Failed to fetch schedules:', schErr.message);
    process.exit(1);
  }

  if (!schedules?.length) {
    console.log('ℹ️   No active schedules found — nothing to clean up.\n');
    return;
  }

  console.log(`Found ${schedules.length} active schedule(s).\n`);

  let grandDeleted = 0;

  for (const sch of schedules) {
    const tag  = `${sch.customer_name} (${sch.customer_phone})`;
    const type = sch.schedule_type || 'weekly';

    // 2. Fetch all future non-cancelled bookings for this customer
    const { data: allBks, error: bkErr } = await supabase
      .from('bookings')
      .select('id, date, time, hours, cleaners, notes')
      .eq('phone', sch.customer_phone)
      .gt('date', todayStr)
      .neq('status', 'Cancelled');

    if (bkErr) {
      console.error(`  ⚠️  ${tag} — fetch error: ${bkErr.message}`);
      continue;
    }

    // 3. Keep only bookings that belong to this schedule (new tag OR legacy)
    const recurringBks = (allBks || []).filter(b => isRecurringFor(b.notes, sch.id));

    if (!recurringBks.length) {
      console.log(`  ✔  ${tag} — no recurring future bookings found`);
      continue;
    }

    // 4. Identify ghost bookings (date falls on a deactivated day/date)
    const activeDays  = type === 'weekly'  ? (sch.days_of_week  || []) : [];
    const activeDates = type === 'monthly' ? (sch.monthly_dates || []) : [];

    const ghosts = recurringBks.filter(b => {
      const d = new Date(b.date + 'T00:00:00');
      return type === 'weekly'
        ? !activeDays.includes(d.getDay())
        : !activeDates.includes(d.getDate());
    });

    if (!ghosts.length) {
      console.log(`  ✔  ${tag} — ${recurringBks.length} booking(s), all on active days`);
      continue;
    }

    console.log(`  🗑  ${tag}`);
    console.log(`      Type: ${type} | Active ${type === 'weekly' ? 'days' : 'dates'}: [${type === 'weekly' ? activeDays.join(',') : activeDates.join(',')}]`);
    console.log(`      Recurring bookings found: ${recurringBks.length}`);
    console.log(`      Ghost bookings to delete: ${ghosts.length}`);
    ghosts.forEach(b => {
      const d   = new Date(b.date + 'T00:00:00');
      const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
      const tag2 = /^\[sch:/.test(b.notes || '') ? '[tagged]' : '[legacy]';
      console.log(`        • ${b.date} (${dow})  ${b.time}  ${b.hours}h  ${tag2}`);
    });

    if (!DRY_RUN) {
      const { error: delErr } = await supabase
        .from('bookings')
        .delete()
        .in('id', ghosts.map(b => b.id));

      if (delErr) {
        console.error(`      ❌  Delete failed: ${delErr.message}`);
      } else {
        grandDeleted += ghosts.length;
        console.log(`      ✅  Deleted ${ghosts.length} ghost booking(s).`);
      }
    } else {
      console.log(`      (dry-run — skipping delete)`);
    }
  }

  console.log(`\n${ DRY_RUN ? '🔍  Dry-run complete.' : `✅  Cleanup complete. Total deleted: ${grandDeleted} ghost booking(s).`}\n`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

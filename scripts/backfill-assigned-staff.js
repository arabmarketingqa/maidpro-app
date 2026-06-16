#!/usr/bin/env node
/**
 * Finds non-cancelled bookings with no assigned_staff and optionally backfills them.
 *
 * The assignment logic mirrors App.jsx exactly:
 *   1. Working day filter   — booking DOW must be in staff.working_days
 *   2. Mode filter          — @mode prefix in staff.skills
 *   3. Skill filter         — skill ID match for hourly bookings (soft: falls back to mode-only pool)
 *   4. Time-overlap check   — skip any maid already assigned to an overlapping booking that day
 *   5. Least-busy ranking   — sort by total job count, pick the N needed
 *
 * Usage:
 *   node scripts/backfill-assigned-staff.js           # audit only — shows affected rows, no changes
 *   node scripts/backfill-assigned-staff.js --apply   # actually update the rows
 */

import { createClient } from '@supabase/supabase-js';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

// Mirror of parseSlotHour from steps.jsx
const parseSlotHour = (timeStr) => {
  if (!timeStr || timeStr === '—') return NaN;
  const [timePart, ampm] = timeStr.trim().split(' ');
  let h = parseInt(timePart.split(':')[0], 10);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return isNaN(h) ? NaN : h;
};

// True when [aStart, aStart+aHours) and [bStart, bStart+bHours) share any time
const overlaps = (aStart, aHours, bStart, bHours) => {
  return aStart < bStart + (bHours || 1) && bStart < aStart + (aHours || 1);
};

// Mirror of isWorkingDay from admin-bundle.jsx
const isWorkingDay = (s, dow) => {
  const days = s.working_days;
  return !Array.isArray(days) || days.length === 0 || days.includes(dow);
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nMaid Pro — backfill assigned_staff  ${APPLY ? '[APPLY MODE]' : '[AUDIT — no changes]'}\n`);

  // ── Step 1: find affected bookings ──────────────────────────────────────────
  // Fetch all non-cancelled bookings and filter client-side — avoids PostgREST
  // inconsistencies around empty-array matching (null vs {} vs []).
  const { data: allBks, error: bkErr } = await supabase
    .from('bookings')
    .select('id, ref, name, date, time, hours, cleaners, service, mode, status, assigned_staff')
    .neq('status', 'Cancelled');

  if (bkErr) {
    console.error('Failed to fetch bookings:', bkErr.message);
    process.exit(1);
  }

  const unassigned = (allBks || []).filter(
    b => !b.assigned_staff || b.assigned_staff.length === 0
  );

  if (!unassigned.length) {
    console.log(`All ${(allBks||[]).length} non-cancelled booking(s) already have assigned staff. Nothing to do.\n`);
    return;
  }

  // ── Step 2: show the list ────────────────────────────────────────────────────
  console.log(`${unassigned.length} non-cancelled booking(s) have no assigned staff:\n`);
  console.log(
    '  ' +
    'Ref'.padEnd(12) +
    'Date'.padEnd(12) +
    'Time'.padEnd(11) +
    'Hrs'.padEnd(5) +
    'Cleaners'.padEnd(10) +
    'Mode'.padEnd(10) +
    'Service'
  );
  console.log('  ' + '─'.repeat(74));

  unassigned.forEach(b => {
    console.log(
      '  ' +
      (b.ref || b.id || '?').padEnd(12) +
      (b.date || '?').padEnd(12) +
      (b.time || '—').padEnd(11) +
      String(b.hours ?? '?').padEnd(5) +
      String(b.cleaners ?? 1).padEnd(10) +
      (b.mode || 'hourly').padEnd(10) +
      (b.service || '—')
    );
  });

  if (!APPLY) {
    console.log(`\nRun with --apply to assign staff to these ${unassigned.length} booking(s).\n`);
    return;
  }

  // ── Step 3: fetch supporting data ────────────────────────────────────────────
  console.log('\nFetching staff and existing assignments...\n');

  const [
    { data: allStaff,    error: sErr },
    { data: assignedBks, error: aErr },
  ] = await Promise.all([
    supabase.from('staff').select('id, name, skills, working_days'),
    supabase.from('bookings')
      .select('id, date, time, hours, assigned_staff')
      .neq('status', 'Cancelled')
      .not('assigned_staff', 'is', null),
  ]);

  if (sErr || !allStaff?.length) {
    console.error('Failed to fetch staff:', sErr?.message || 'empty response');
    process.exit(1);
  }
  if (aErr) {
    console.error('Failed to fetch existing assignments:', aErr.message);
    process.exit(1);
  }

  // Build mutable list of assigned bookings so within-run assignments are visible
  const assignmentPool = [...(assignedBks || [])];

  // Total job count per maid for least-busy ranking
  const jobCounts = {};
  assignmentPool.forEach(b => {
    (b.assigned_staff || []).forEach(sid => {
      jobCounts[sid] = (jobCounts[sid] || 0) + 1;
    });
  });

  // Fetch services table for service-name → skill-ID mapping (best-effort)
  const serviceSkillMap = {}; // e.g. { "regular cleaning": "regular" }
  try {
    const { data: svcs } = await supabase.from('services').select('id, name');
    (svcs || []).forEach(s => {
      if (s.name) serviceSkillMap[s.name.toLowerCase()] = s.id;
    });
  } catch (_) { /* services table not available — skill matching skipped */ }

  // ── Step 4: assign each booking ──────────────────────────────────────────────
  console.log('Assigning staff...\n');
  let updated = 0, skipped = 0, failed = 0;

  for (const b of unassigned) {
    const ref    = b.ref || b.id;
    const needed = Math.max(1, b.cleaners || 1);
    const mode   = b.mode || 'hourly';
    const startH = parseSlotHour(b.time);
    const hours  = b.hours || 1;

    if (!b.date) {
      console.log(`  SKIP  ${ref}  — missing date`);
      skipped++;
      continue;
    }
    if (isNaN(startH)) {
      console.log(`  SKIP  ${ref}  — unparseable time "${b.time}"`);
      skipped++;
      continue;
    }

    const dow = new Date(b.date + 'T00:00:00').getDay();

    // 1. Working day filter
    let pool = allStaff.filter(s => isWorkingDay(s, dow));

    // 2. Mode filter (@mode prefix in skills)
    pool = pool.filter(s => {
      const sk = Array.isArray(s.skills) ? s.skills : [];
      const modes = sk.filter(x => x.startsWith('@')).map(x => x.slice(1));
      return modes.length === 0 || modes.includes(mode);
    });

    // 3. Skill filter for hourly bookings (soft: only applies if a skill ID is found)
    if (mode === 'hourly' && b.service) {
      const svcId = serviceSkillMap[b.service.toLowerCase()];
      if (svcId) {
        const skilled = pool.filter(s =>
          (Array.isArray(s.skills) ? s.skills : []).filter(x => !x.startsWith('@')).includes(svcId)
        );
        if (skilled.length > 0) pool = skilled;
        // If no skilled match, fall through to the full mode-filtered pool
      }
    }

    if (pool.length === 0) {
      console.log(`  SKIP  ${ref}  ${b.date} (${DOW[dow]})  — no staff match mode/skill`);
      skipped++;
      continue;
    }

    // 4. Time-overlap filter — exclude maids busy on the same date at the same time
    const sameDateAssigned = assignmentPool.filter(x => x.date === b.date);
    pool = pool.filter(s => {
      return !sameDateAssigned.some(x => {
        if (!(x.assigned_staff || []).includes(s.id)) return false;
        const xStart = parseSlotHour(x.time);
        if (isNaN(xStart)) return false;
        return overlaps(startH, hours, xStart, x.hours || 1);
      });
    });

    if (pool.length === 0) {
      console.log(`  SKIP  ${ref}  ${b.date} (${DOW[dow]})  ${b.time}  — all matching staff busy at this time`);
      skipped++;
      continue;
    }

    // 5. Least-busy ranking, pick N
    const sorted   = [...pool].sort((a, z) => (jobCounts[a.id] || 0) - (jobCounts[z.id] || 0));
    const assigned = sorted.slice(0, needed).map(s => s.id);
    const names    = assigned.map(id => allStaff.find(s => s.id === id)?.name || id);

    // 6. Update the row
    const { error: updErr } = await supabase
      .from('bookings')
      .update({ assigned_staff: assigned })
      .eq('id', b.id);

    if (updErr) {
      console.log(`  FAIL  ${ref}  — ${updErr.message}`);
      failed++;
    } else {
      console.log(`  OK    ${ref}  ${b.date} (${DOW[dow]})  ${b.time}  →  [${names.join(', ')}]`);
      // Keep in-memory state current so the rest of this batch sees these assignments
      assigned.forEach(id => { jobCounts[id] = (jobCounts[id] || 0) + 1; });
      assignmentPool.push({ id: b.id, date: b.date, time: b.time, hours, assigned_staff: assigned });
      updated++;
    }
  }

  console.log(`\nDone.  Updated: ${updated}  |  Skipped: ${skipped}  |  Failed: ${failed}\n`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

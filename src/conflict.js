// ─────────────────────────────────────────────────────────────────────────
//  DOUBLE-BOOKING PREVENTION
//  A maid (cleaner) must NEVER be assigned to two bookings whose time ranges
//  overlap on the same date. This module is the single source of truth for
//  that rule — every assignment path (customer auto-assign, admin auto-assign,
//  manual booking modal, the inline "Assign maids" dropdown, recurring
//  schedule generation, and reschedule/edit) calls into it.
//
//  Time is stored on bookings as a label string ("9:00 AM") plus a numeric
//  `hours` duration. A booking therefore occupies the half-open interval
//  [start, start + hours). Two intervals OVERLAP when:
//        existingStart < newEnd  AND  newStart < existingEnd
//  The half-open comparison means back-to-back bookings (e.g. 9–12 then 12–3)
//  do NOT count as a conflict.
// ─────────────────────────────────────────────────────────────────────────

// Parse a time label ("9:00 AM", "12:30 PM", "14:00") into a decimal hour.
// Returns NaN when the value can't be understood — callers treat NaN as
// "unknown time" and skip it rather than guessing.
export function parseTimeToHours(t) {
  if (t == null) return NaN;
  const str = String(t).trim();
  if (!str || str === '—') return NaN;
  const upper = str.toUpperCase();
  const isPM = upper.includes('PM');
  const isAM = upper.includes('AM');
  const [hStr, mStr] = str.replace(/[^0-9:]/g, '').split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return NaN;
  const m = parseInt(mStr, 10) || 0;
  let hour = h;
  if (isPM && h !== 12) hour = h + 12;
  if (isAM && h === 12) hour = 0;
  return hour + m / 60;
}

// True when [aStart,aEnd) and [bStart,bEnd) overlap (half-open intervals).
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

const isCancelled = (status) =>
  String(status || '').trim().toLowerCase() === 'cancelled';

// Format a decimal hour back into a "9:00 AM" label for user-facing messages.
export function formatHour(dec) {
  if (isNaN(dec)) return '—';
  let h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  const ap = h < 12 ? 'AM' : 'PM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

// PURE conflict check against a list of booking rows already in memory.
//   rows             : array of { id, ref, time, hours, assigned_staff, status }
//   maidId           : staff UUID to test
//   newStart/newEnd  : decimal-hour interval of the candidate booking
//   excludeBookingId : a booking id to ignore (so an edited booking never
//                      conflicts with itself); compared loosely (string).
// Returns the first conflicting row (with a friendly `range` label) or null.
export function findConflictInRows(rows, maidId, newStart, newEnd, excludeBookingId = null) {
  if (isNaN(newStart) || isNaN(newEnd)) return null; // unknown time → can't judge
  for (const b of rows || []) {
    if (excludeBookingId != null && String(b.id) === String(excludeBookingId)) continue;
    if (isCancelled(b.status)) continue;
    const staff = Array.isArray(b.assigned_staff) ? b.assigned_staff : [];
    if (!staff.includes(maidId)) continue;          // per-maid, not per-booking
    const exStart = parseTimeToHours(b.time);
    if (isNaN(exStart)) continue;
    const exEnd = exStart + (Number(b.hours) || 0);
    if (rangesOverlap(exStart, exEnd, newStart, newEnd)) {
      return {
        id: b.id,
        ref: b.ref || '—',
        time: b.time || formatHour(exStart),
        hours: Number(b.hours) || 0,
        range: `${b.time || formatHour(exStart)}–${formatHour(exEnd)}`,
      };
    }
  }
  return null;
}

// Fetch the same-company, same-date bookings needed for a conflict check.
// Returns the rows (cancelled ones included — findConflictInRows filters them).
// `client` is a raw supabase client; scoping is applied here via company_id.
export async function fetchDayBookings(client, companyId, date) {
  if (!client || companyId == null || !date) return [];
  const { data, error } = await client
    .from('bookings')
    .select('id, ref, time, hours, assigned_staff, status')
    .eq('company_id', companyId)
    .eq('date', date);
  if (error || !data) return [];
  return data;
}

// ASYNC convenience: check ONE maid against the database for a single booking.
// Returns the conflicting booking ({ ref, time, range, ... }) or null.
//   opts = { maidId, date, startTime, durationHours, companyId, excludeBookingId }
export async function hasTimeConflict(client, opts) {
  const { maidId, date, startTime, durationHours, companyId, excludeBookingId = null } = opts || {};
  const newStart = parseTimeToHours(startTime);
  if (isNaN(newStart)) return null; // unknown time → don't block
  const newEnd = newStart + (Number(durationHours) || 0);
  const rows = await fetchDayBookings(client, companyId, date);
  return findConflictInRows(rows, maidId, newStart, newEnd, excludeBookingId);
}

// Given a pool of candidate maid ids and the day's bookings, return only the
// maids that are FREE for the [startTime, +duration) interval. Used by the
// auto-assign paths so they only ever pick genuinely-available maids.
export function filterFreeMaids(candidateIds, rows, startTime, durationHours, excludeBookingId = null) {
  const newStart = parseTimeToHours(startTime);
  if (isNaN(newStart)) return candidateIds; // unknown time → can't filter
  const newEnd = newStart + (Number(durationHours) || 0);
  return (candidateIds || []).filter(
    id => !findConflictInRows(rows, id, newStart, newEnd, excludeBookingId)
  );
}

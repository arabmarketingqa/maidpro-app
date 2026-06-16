// Stale-While-Revalidate cache for the booking page.
// Stores already-processed state (not raw DB rows), so cache hits skip all transforms.

const KEY = 'mp_bk2';
const TTL = 5 * 60 * 1000; // 5 minutes

export function readBookingCache() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { d, t } = JSON.parse(raw);
    if (Date.now() - t > TTL) { localStorage.removeItem(KEY); return null; }
    return d;
  } catch (_) { return null; }
}

export function writeBookingCache(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ d: data, t: Date.now() }));
  } catch (_) {}
}

export function invalidateBookingCache() {
  try { localStorage.removeItem(KEY); } catch (_) {}
}

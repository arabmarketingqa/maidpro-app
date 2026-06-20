import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || 'https://krijpvoonlpwxinohthb.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaWpwdm9vbmxwd3hpbm9odGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MjY4NTIsImV4cCI6MjA5MzQwMjg1Mn0.Dm7hUBswMT-kqF7gzgsOQIP9OOZpH9yYrEHyYFQJ-UI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false, // admin uses OTP flow — never receives auth tokens via URL
  },
})

// Cross-tab instant cache invalidation — admin saves broadcast here; booking page listens
export const SETTINGS_SYNC_CHANNEL = 'mp-settings-sync';
export const SETTINGS_SYNC_KEY = 'mp_settings_ts';

export function broadcastSettingsUpdate() {
  const ts = String(Date.now());
  // localStorage storage event fires in every OTHER same-origin tab
  try { localStorage.setItem(SETTINGS_SYNC_KEY, ts); } catch (_) {}
  // BroadcastChannel works even between same-origin pages in the same browser
  try {
    const bc = new BroadcastChannel(SETTINGS_SYNC_CHANNEL);
    bc.postMessage({ type: 'settings_updated', ts });
    bc.close();
  } catch (_) {}
}

const MODE_LABELS = { hourly: 'Hourly', monthly: 'Monthly', stayin: 'Stay-In' }

/* Transform a DB booking row → shape expected by the admin UI */
export function fmtBooking(b) {
  const d = b.date ? new Date(b.date + 'T00:00:00') : null
  const dateStr = d
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'
  const total    = Number(b.total) || 0;
  const paidAmt  = Number(b.paid_amount) || 0;
  return {
    ref:            b.ref || String(b.id),
    customer:       b.name  || '—',
    phone:          b.phone || '—',
    service:        b.service || '—',
    mode:           MODE_LABELS[b.mode] || 'Hourly',
    date:           dateStr,
    time:           b.time  || '—',
    maids:          b.cleaners ?? 1,
    hours:          b.hours ?? 0,
    total,
    paid_amount:    paidAmt,
    payment_status: (paidAmt >= total && total > 0) ? 'Paid' : 'Pending',
    status:         b.status || 'Pending',
    _raw:           b,
  }
}

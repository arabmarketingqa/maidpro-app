import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://krijpvoonlpwxinohthb.supabase.co',
  'sb_publishable_yasJgNuQhlyPtbS1e3Lsvg_6mLkTHrt'
)

/* Transform a DB booking row → shape expected by the admin UI */
export function fmtBooking(b) {
  const d = b.date ? new Date(b.date + 'T00:00:00') : null
  const dateStr = d
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'
  return {
    ref:      b.ref || b.id?.slice(0, 8).toUpperCase(),
    customer: b.name  || '—',
    phone:    b.phone || '—',
    service:  b.service || '—',
    mode:     'Hourly',
    date:     dateStr,
    time:     b.time  || '—',
    maids:    b.cleaners ?? 1,
    hours:    b.hours ?? 0,
    total:    Number(b.total) || 0,
    status:   b.status || 'New',
    _raw:     b,
  }
}

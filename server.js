require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── Settings (stored in Supabase — works on Vercel serverless) ────────────────

async function readSettings() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'main')
      .single();
    if (error || !data) return {};
    return data.data || {};
  } catch { return {}; }
}

async function writeSettings(patch) {
  try {
    const cur = await readSettings();
    const updated = { ...cur, ...patch };
    await supabase.from('settings').upsert({ id: 'main', data: updated });
    return updated;
  } catch { return patch; }
}

app.get('/api/settings', async (req, res) => {
  res.json(await readSettings());
});

app.post('/api/settings', async (req, res) => {
  res.json(await writeSettings(req.body));
});

// ── Scheduling utilities ──────────────────────────────────────────────────────

// "9:00 AM" → minutes since midnight (e.g. 540)
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hm, period] = timeStr.trim().split(' ');
  let [h, m] = hm.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + (m || 0);
}

// True when [startA, startA+hoursA*60) overlaps with [startB, startB+hoursB*60)
function slotsOverlap(startA, hoursA, startB, hoursB) {
  return startA < startB + hoursB * 60 && startB < startA + hoursA * 60;
}

// Split a maid field (may be comma-separated) into an array of trimmed names
function splitMaids(maidStr) {
  return (maidStr || '').split(',').map(n => n.trim()).filter(Boolean);
}

// Returns up to `count` least-busy Available maids with no time conflict.
// Existing bookings may already carry comma-separated maid names.
async function findAvailableMaids(date, timeStr, hours, count = 1) {
  const { data: staff, error: sErr } = await supabase
    .from('staff').select('name').eq('status', 'Available');
  if (sErr || !staff || staff.length === 0) return [];

  const { data: dayBks } = await supabase
    .from('bookings')
    .select('maid, time, hours')
    .eq('date', date)
    .neq('status', 'Cancelled');

  const newStart = parseTimeToMinutes(timeStr);
  const newHours = parseInt(hours) || 4;

  // Build set of maids who are busy during the requested window
  const busy = new Set();
  (dayBks || []).forEach(bk => {
    if (slotsOverlap(newStart, newHours, parseTimeToMinutes(bk.time), parseInt(bk.hours) || 4)) {
      splitMaids(bk.maid).forEach(name => busy.add(name));
    }
  });

  // Collect free maids with their total job counts
  const free = staff
    .filter(s => !busy.has(s.name))
    .map(s => ({
      name: s.name,
      jobCount: (dayBks || []).reduce((n, bk) => n + (splitMaids(bk.maid).includes(s.name) ? 1 : 0), 0),
    }));

  free.sort((a, b) => a.jobCount - b.jobCount);
  return free.slice(0, count).map(s => s.name);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapBooking(row) {
  return {
    ref:       row.ref,
    name:      row.name,
    phone:     row.phone,
    service:   row.service,
    date:      row.date,
    time:      row.time,
    area:      row.area      || '',
    hours:     row.hours,
    cleaners:  row.cleaners,
    materials: row.materials,
    rate:      row.rate,
    total:     row.total,
    address:   row.address   || '',
    lat:       row.lat       || '',
    lng:       row.lng       || '',
    notes:     row.notes     || '',
    status:         row.status,
    maid:           row.maid           || '',
    payment_method: row.payment_method || '',
    paid_amount:    parseFloat(row.paid_amount)  || 0,
    due_amount:     Math.max(0, (parseFloat(row.total) || 0) - (parseFloat(row.paid_amount) || 0)),
    created:        row.created_at,
  };
}

function mapStaff(row) {
  return {
    id:          row.id,
    name:        row.name,
    phone:       row.phone        || '',
    nationality: row.nationality  || '',
    status:      row.status,
    color:       row.color,
    joinDate:    row.join_date    || '',
    notes:       row.notes        || '',
  };
}

function mapCustomer(row) {
  return {
    id:        row.id,
    name:      row.name,
    phone:     row.phone    || '',
    area:      row.area     || '',
    address:   row.address  || '',
    email:     row.email    || '',
    notes:     row.notes    || '',
    tag:       row.tag      || 'new',
    createdAt: row.created_at,
  };
}

async function nextRef() {
  const { count, error } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return 'CP-' + String((count || 0) + 1).padStart(3, '0');
}

// ── BOOKINGS ──────────────────────────────────────────────────────────────────

app.get('/api/bookings', async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(mapBooking));
});

app.post('/api/bookings', async (req, res) => {
  const b = req.body;
  let ref;
  try { ref = await nextRef(); } catch (e) { return res.status(500).json({ error: e.message }); }

  // Auto-assign: pick one maid per cleaner, all conflict-free at this date/time
  const cleanerCount = parseInt(b.cleaners) || 1;
  let maidName = b.maid || null;
  if (!maidName) {
    try {
      const assigned = await findAvailableMaids(b.date, b.time, b.hours, cleanerCount);
      if (assigned.length) {
        maidName = assigned.join(',');
        console.log(`Auto-assigned → ${maidName} (${assigned.length}/${cleanerCount} cleaners)`);
      } else {
        console.log('Auto-assign: no maids free at', b.date, b.time);
      }
    } catch (e) {
      console.error('Auto-assign failed:', e.message);
    }
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert([{
      ref,
      name:      b.name,
      phone:     b.phone,
      service:   b.service,
      date:      b.date,
      time:      b.time,
      area:      b.area      || '',
      hours:     b.hours,
      cleaners:  b.cleaners  || 1,
      materials: b.materials || false,
      rate:      b.rate,
      total:     b.total,
      address:   b.address   || '',
      lat:       b.lat       || '',
      lng:       b.lng       || '',
      notes:     b.notes     || '',
      status:    'New',
      maid:      maidName,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(mapBooking(data));
});

app.patch('/api/bookings/:ref/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['New', 'Confirmed', 'Completed', 'Cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('ref', req.params.ref)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(mapBooking(data));
});

// Mark booking as Completed and record payment details
app.patch('/api/bookings/:ref/complete', async (req, res) => {
  const { payment_method, paid_amount } = req.body;
  const paidAmt = parseFloat(paid_amount) || 0;

  console.log(`[PAYMENT] ref=${req.params.ref} | received paid_amount="${paid_amount}" | parsed=${paidAmt} | method=${payment_method}`);

  const { data, error } = await supabase
    .from('bookings')
    .update({
      status:         'Completed',
      payment_method: payment_method || 'Cash',
      paid_amount:    paidAmt,
    })
    .eq('ref', req.params.ref)
    .select()
    .single();

  if (error) {
    console.error(`[PAYMENT] Supabase error:`, error.message);
    // If column missing, give an actionable message
    if (error.message.includes('paid_amount') || error.message.includes('payment_method')) {
      return res.status(500).json({ error: 'Payment columns missing from database. Run fix-payment-system.sql in Supabase SQL Editor first.' });
    }
    return res.status(500).json({ error: error.message });
  }

  console.log(`[PAYMENT] Saved OK → paid_amount=${data.paid_amount} | total=${data.total} | due=${Math.max(0, data.total - data.paid_amount)}`);
  res.json(mapBooking(data));
});

app.patch('/api/bookings/:ref/maid', async (req, res) => {
  const { maid } = req.body;
  const { data, error } = await supabase
    .from('bookings')
    .update({ maid })
    .eq('ref', req.params.ref)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(mapBooking(data));
});

app.delete('/api/bookings', async (req, res) => {
  const { error } = await supabase.from('bookings').delete().neq('ref', '');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Returns time slots where fewer free maids exist than requested cleaner count.
// GET /api/availability?date=YYYY-MM-DD&hours=4&cleaners=2
app.get('/api/availability', async (req, res) => {
  const { date, hours = 4, cleaners = 1 } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });

  const { data: staff } = await supabase
    .from('staff').select('name').eq('status', 'Available');
  if (!staff || staff.length === 0) return res.json({ blockedSlots: [] });

  const { data: dayBks } = await supabase
    .from('bookings')
    .select('maid, time, hours')
    .eq('date', date)
    .neq('status', 'Cancelled');

  const reqHours    = parseInt(hours)    || 4;
  const reqCleaners = parseInt(cleaners) || 1;
  const ALL_SLOTS   = [
    '8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM',
    '1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM',
  ];

  const blockedSlots = ALL_SLOTS.filter(slot => {
    const slotStart = parseTimeToMinutes(slot);
    // Build set of busy maids at this slot
    const busy = new Set();
    (dayBks || []).forEach(bk => {
      if (slotsOverlap(slotStart, reqHours, parseTimeToMinutes(bk.time), parseInt(bk.hours) || 4)) {
        splitMaids(bk.maid).forEach(name => busy.add(name));
      }
    });
    const freeCount = staff.filter(s => !busy.has(s.name)).length;
    // Blocked if not enough free maids for requested cleaner count
    return freeCount < reqCleaners;
  });

  res.json({ blockedSlots });
});

// ── STAFF ─────────────────────────────────────────────────────────────────────

app.get('/api/staff', async (req, res) => {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(mapStaff));
});

app.post('/api/staff', async (req, res) => {
  const s = req.body;
  const id = s.id || ('s' + Date.now());
  const { data, error } = await supabase
    .from('staff')
    .insert([{
      id,
      name:        s.name,
      phone:       s.phone        || '',
      nationality: s.nationality  || '',
      status:      s.status       || 'Available',
      color:       s.color        || '#0d9488',
      join_date:   s.joinDate     || null,
      notes:       s.notes        || '',
    }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(mapStaff(data));
});

app.put('/api/staff/:id', async (req, res) => {
  const s = req.body;
  const { data, error } = await supabase
    .from('staff')
    .update({
      name:        s.name,
      phone:       s.phone        || '',
      nationality: s.nationality  || '',
      status:      s.status,
      color:       s.color,
      join_date:   s.joinDate     || null,
      notes:       s.notes        || '',
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(mapStaff(data));
});

app.delete('/api/staff/:id', async (req, res) => {
  const { error } = await supabase.from('staff').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────

app.get('/api/customers', async (req, res) => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(mapCustomer));
});

app.post('/api/customers', async (req, res) => {
  const c = req.body;
  const id = c.id || ('c_' + (c.phone || '').replace(/\D/g, '') + '_' + Date.now());
  const { data, error } = await supabase
    .from('customers')
    .upsert([{
      id,
      name:    c.name,
      phone:   c.phone    || '',
      area:    c.area     || '',
      address: c.address  || '',
      email:   c.email    || '',
      notes:   c.notes    || '',
      tag:     c.tag      || 'new',
    }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(mapCustomer(data));
});

app.put('/api/customers/:id', async (req, res) => {
  const c = req.body;
  const { data, error } = await supabase
    .from('customers')
    .update({
      name:    c.name,
      phone:   c.phone    || '',
      area:    c.area     || '',
      address: c.address  || '',
      email:   c.email    || '',
      notes:   c.notes    || '',
      tag:     c.tag,
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(mapCustomer(data));
});

app.delete('/api/customers/:id', async (req, res) => {
  const { error } = await supabase.from('customers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/customers', async (req, res) => {
  const { error } = await supabase.from('customers').delete().neq('id', '');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── Seed default staff if table is empty ──────────────────────────────────────

async function seedDefaultStaff() {
  try {
    const { count, error } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true });
    if (error) {
      console.log('ℹ️  Staff table not ready yet — run add-staff-customers-tables.sql in Supabase.');
      return;
    }
    if (count === 0) {
      const { error: insertErr } = await supabase.from('staff').insert([
        { id: 's1', name: 'Nelly',   phone: '', nationality: '', status: 'Available', color: '#0d9488', notes: '' },
        { id: 's2', name: 'Ivon',    phone: '', nationality: '', status: 'Available', color: '#3b82f6', notes: '' },
        { id: 's3', name: 'Fiona',   phone: '', nationality: '', status: 'Available', color: '#8b5cf6', notes: '' },
        { id: 's4', name: 'Nasra',   phone: '', nationality: '', status: 'Available', color: '#f59e0b', notes: '' },
        { id: 's5', name: 'Fiona B', phone: '', nationality: '', status: 'Available', color: '#ef4444', notes: '' },
      ]);
      if (insertErr) console.log('⚠️  Could not seed staff:', insertErr.message);
      else console.log('✅ Default staff seeded (Nelly, Ivon, Fiona, Nasra, Fiona B)');
    }
  } catch (e) {
    console.log('ℹ️  Staff seed skipped:', e.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`CleanPro server running at http://localhost:${PORT}`);
    console.log(`Booking page: http://localhost:${PORT}/index.html`);
    console.log(`Admin panel:  http://localhost:${PORT}/admin-panel.html`);
    await seedDefaultStaff();
  });
} else {
  seedDefaultStaff().catch(() => {});
}

module.exports = app;

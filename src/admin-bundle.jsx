import React from 'react'
import { supabase, fmtBooking, broadcastSettingsUpdate } from './supabase'
import { hasTimeConflict, fetchDayBookings, findConflictInRows, filterFreeMaids, parseTimeToHours } from './conflict'
import { SVC_ICONS, SVC_ICON_NAMES, SvcIcon } from './serviceIcons'
import { COUNTRIES as BRAND_COUNTRIES, dialCodeFor, timezoneFor } from './countries'
import { useAdminI18n } from './admin-i18n'

// A cancelled booking must never count toward any revenue/received/outstanding
// figure. Case/whitespace-tolerant so legacy rows stored as "cancelled" still match.
const isCancelledBooking = (b) => String(b?.status || '').trim().toLowerCase() === 'cancelled'

/* ─────────────────────────────────────────────────────────────────────────
   MULTI-TENANT SCOPING
   Every tenant query in this admin bundle goes through db('<table>') instead
   of supabase.from('<table>'). The wrapper transparently constrains reads
   (.eq company_id), constrains updates/deletes (.eq company_id, caller still
   chains .eq('id', …)), and injects company_id into insert/upsert payloads.
   It returns the underlying Supabase builder, so every existing chain
   (.order/.eq/.neq/.maybeSingle/.limit/{count,head}/…) keeps working.

   SCOPED_COMPANY_ID is set BEFORE AdminPanel mounts (see AuthedAdmin) and
   AdminPanel is keyed by company id, so switching company fully remounts it
   with fresh, scoped data. Tenant queries never run while it is null.
   NOTE: control-plane tables (companies, profiles) and supabase.auth /
   supabase.channel are intentionally NOT scoped and use supabase directly.
   ───────────────────────────────────────────────────────────────────────── */
let SCOPED_COMPANY_ID = null;
export function setScopedCompany(id) { SCOPED_COMPANY_ID = id ?? null; }
export function getScopedCompany() { return SCOPED_COMPANY_ID; }

function withCompany(rows, cid) {
  const add = (r) =>
    (r && typeof r === 'object' && !Array.isArray(r)) ? { ...r, company_id: cid } : r;
  return Array.isArray(rows) ? rows.map(add) : add(rows);
}

function db(table) {
  const cid = SCOPED_COMPANY_ID;
  const q = supabase.from(table);
  return {
    select: (...a) => q.select(...a).eq('company_id', cid),
    insert: (rows) => q.insert(withCompany(rows, cid)),
    update: (patch) => q.update(patch).eq('company_id', cid),
    delete: () => q.delete().eq('company_id', cid),
    upsert: (rows, opts) => q.upsert(withCompany(rows, cid), opts),
  };
}

/* ── Booking notification chime (Web Audio API — no file needed) ── */
const playBookingChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const play = () => {
      const master = ctx.createGain();
      master.gain.value = 0.75;
      master.connect(ctx.destination);
      const t = ctx.currentTime;
      // Ascending C6 → E6 → G6 major chord chime
      [[1046.50, 0, 0.65], [1318.51, 0.16, 0.65], [1567.98, 0.32, 0.90]].forEach(([freq, delay, dur]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(master);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.9, t + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.start(t + delay);
        osc.stop(t + delay + dur + 0.05);
      });
    };
    // AudioContext starts suspended on many browsers until a user gesture
    if (ctx.state === 'suspended') ctx.resume().then(play); else play();
  } catch (e) {
    console.warn('Booking chime failed:', e);
  }
};

// Normalise any flag value (emoji or ISO code) → lowercase 2-letter ISO code ("in", "np", "ph"…)
const toISO = (s) => {
  if (!s) return '';
  const t = s.trim();
  if (/^[A-Z]{2}$/i.test(t)) return t.toLowerCase();
  const pts = [...t].map(c => c.codePointAt(0));
  if (pts.length >= 2 && pts[0] >= 0x1F1E6 && pts[0] <= 0x1F1FF)
    return pts.slice(0,2).map(p => String.fromCharCode(p - 0x1F1E6 + 65)).join('').toLowerCase();
  return '';
};
const toFlag = toISO; // kept for backward compat

// Returns true if staff member works on the day of week of dateStr ("YYYY-MM-DD"). 0=Sun…6=Sat.
const isWorkingDay = (s, dateStr) => {
  const days = s.working_days;
  if (!Array.isArray(days)) return true;   // column not in DB yet → assume all days
  if (days.length === 0) return false;     // all days explicitly turned off → never working
  return days.includes(new Date(dateStr + 'T00:00:00').getDay());
};

// Flag image component — renders a real country flag via flagcdn.com
const Flag = ({ code, size = 24, className = '' }) => {
  const iso = toISO(code);
  if (!iso) return <span className="text-[16px]">🌍</span>;
  return (
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      alt={iso.toUpperCase()}
      width={size}
      height={Math.round(size * 0.67)}
      className={`object-cover rounded-sm inline-block ${className}`}
      onError={e => { e.currentTarget.style.display = 'none'; }}
    />
  );
};

/* Admin UI primitives — exposed on window for cross-script access */

const AdminIcon = ({ name, className = "w-5 h-5", strokeWidth = 1.6 }) => {
  const c = { fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", className };
  switch (name) {
    case "grid":      return <svg {...c}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
    case "list":      return <svg {...c}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>;
    case "broom":     return <svg {...c}><path d="M14 4l6 6"/><path d="M11 7l6 6-7 7H4v-6l7-7z"/><path d="M5 14l5 5"/></svg>;
    case "globe":     return <svg {...c}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>;
    case "package":   return <svg {...c}><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>;
    case "spray":     return <svg {...c}><rect x="9" y="9" width="8" height="12" rx="1.5"/><path d="M9 12h-3M5 5h2v4M9 7h6M11 4h2"/></svg>;
    case "sliders":   return <svg {...c}><path d="M4 6h11M4 12h6M4 18h11"/><circle cx="18" cy="6" r="2"/><circle cx="13" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>;
    case "settings":  return <svg {...c}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>;
    case "search":    return <svg {...c}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case "bell":      return <svg {...c}><path d="M6 8a6 6 0 0112 0v5l1.5 3h-15L6 13z"/><path d="M10 19a2 2 0 004 0"/></svg>;
    case "plus":      return <svg {...c}><path d="M12 5v14M5 12h14"/></svg>;
    case "minus":     return <svg {...c}><path d="M5 12h14"/></svg>;
    case "x":         return <svg {...c}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case "menu":      return <svg {...c}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case "edit":      return <svg {...c}><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>;
    case "trash":     return <svg {...c}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/></svg>;
    case "check":     return <svg {...c}><path d="M4 12.5l5 5L20 6.5"/></svg>;
    case "chevron":   return <svg {...c}><path d="M6 9l6 6 6-6"/></svg>;
    case "arrow-up":  return <svg {...c}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case "arrow-down":return <svg {...c}><path d="M12 5v14M5 12l7 7 7-7"/></svg>;
    case "filter":    return <svg {...c}><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></svg>;
    case "download":  return <svg {...c}><path d="M12 3v12M6 11l6 6 6-6M4 21h16"/></svg>;
    case "logout":    return <svg {...c}><path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4"/><path d="M10 17l-5-5 5-5M5 12h11"/></svg>;
    case "support":   return <svg {...c}><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 116 0c0 1.5-1.5 2-3 3v1"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>;
    case "trend":     return <svg {...c}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
    case "calendar":  return <svg {...c}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case "users":     return <svg {...c}><circle cx="9" cy="8" r="3.5"/><path d="M3 20c1-3.5 3.5-5 6-5s5 1.5 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 20c.5-2.5 2-3.5 4-3.5"/></svg>;
    case "money":     return <svg {...c}><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 9h.01M18 16h.01"/></svg>;
    case "sparkle":   return <svg {...c}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M18.5 5.5l-2.8 2.8M8.3 15.7l-2.8 2.8"/></svg>;
    case "home":        return <svg {...c}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case "arrow-left":  return <svg {...c}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>;
    case "arrow-right": return <svg {...c}><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
    case "contact":     return <svg {...c}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
    case "print":       return <svg {...c}><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="10" rx="1.5"/><path d="M6 14h12M6 18h12"/><rect x="6" y="14" width="3" height="5"/></svg>;
    default: return null;
  }
};

/* ── Public booking link helpers (shared by the dashboard cards + admin panel) ── */
const bookingUrl = (slug) => `${window.location.origin}/${slug}`;

function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  } catch (_) {}
  return Promise.resolve();
}

const CopyLinkInline = ({ slug }) => {
  const [copied, setCopied] = React.useState(false);
  if (!slug) return <span className="text-[11.5px] text-ink-400 italic">No booking link — set a slug</span>;
  const url = bookingUrl(slug);
  const doCopy = async () => { await copyText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
      <span className="font-mono text-[11.5px] text-ink-600 truncate" title={url}>{url}</span>
      <button onClick={doCopy}
        className="flex-shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-ink-200 text-ink-700 hover:bg-ink-50 text-[11.5px] font-semibold transition-colors">
        {copied ? <AdminIcon name="check" className="w-3.5 h-3.5"/> : null}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
};

const Switch = ({ on, onChange, dim, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={!!on}
    aria-label={ariaLabel}
    onClick={() => !dim && onChange(!on)}
    className={`switch ${on ? "on" : ""} ${dim ? "dim" : ""}`}
  />
);

const Card = ({ title, subtitle, action, children, className = "", padded = true }) => (
  <section className={`bg-white rounded-xl2 hairline shadow-card ${className}`}>
    {(title || action) && (
      <header className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 border-b border-ink-200/70">
        <div>
          {title && <h3 className="text-[15px] font-bold text-ink-900 tracking-tight">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-500 leading-snug">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </header>
    )}
    <div className={padded ? "p-5 sm:p-6" : ""}>{children}</div>
  </section>
);

const PrimaryBtn = ({ children, onClick, disabled, size = "md", className = "" }) => {
  const sz = size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-10 px-4 text-[13.5px]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 ${sz} rounded-lg bg-mint-500 hover:bg-mint-400 active:bg-mint-600 text-ink-900 font-semibold shadow-mint disabled:bg-ink-200 disabled:text-ink-500 disabled:shadow-none transition-colors ${className}`}
    >
      {children}
    </button>
  );
};

const GhostBtn = ({ children, onClick, size = "md", tone = "ink", className = "" }) => {
  const sz = size === "sm" ? "h-9 px-3 text-[13px]" : "h-10 px-3.5 text-[13.5px]";
  const tones = {
    ink:  "text-ink-700 hover:bg-ink-100",
    danger: "text-red-600 hover:bg-red-50",
    mint: "text-mint-700 hover:bg-mint-50",
  };
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 ${sz} rounded-lg font-medium ${tones[tone]} transition-colors ${className}`}>
      {children}
    </button>
  );
};

const IconBtn = ({ icon, onClick, tone = "ink", title }) => {
  const tones = {
    ink:    "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
    danger: "text-ink-500 hover:bg-red-50 hover:text-red-600",
  };
  return (
    <button type="button" onClick={onClick} title={title}
      className={`w-8 h-8 rounded-lg grid place-items-center transition-colors ${tones[tone]}`}>
      <AdminIcon name={icon} className="w-4 h-4" />
    </button>
  );
};

const IconPicker = ({ value, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const cur = value && SVC_ICONS[value] ? value : 'Sparkles';
  const Cur = SVC_ICONS[cur];
  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} title={`Icon: ${cur}`}
        className="w-12 h-12 rounded-lg hairline bg-ink-50 hover:bg-ink-100 grid place-items-center transition-colors group">
        <Cur className="w-6 h-6 text-ink-700" strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute left-0 top-[52px] z-50 bg-white rounded-xl shadow-float hairline p-2 w-[216px]">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 px-1 pb-1.5">Choose icon</div>
          <div className="grid grid-cols-6 gap-1">
            {SVC_ICON_NAMES.map(name => {
              const Ic = SVC_ICONS[name];
              const active = cur === name;
              return (
                <button key={name} type="button" title={name}
                  onClick={() => { onChange(name); setOpen(false); }}
                  className={`w-8 h-8 rounded-lg grid place-items-center transition-colors
                    ${active ? 'bg-mint-100 ring-2 ring-mint-500 text-mint-700' : 'hover:bg-ink-100 text-ink-600'}`}>
                  <Ic className="w-4 h-4" strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const TextField = ({ value, onChange, placeholder, type = "text", icon, suffix, className = "", inputClassName = "" }) => (
  <div className={`relative ${className}`}>
    {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"><AdminIcon name={icon} className="w-4 h-4" /></span>}
    <input
      type={type}
      value={value ?? ""}
      onChange={e => onChange(type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
      placeholder={placeholder}
      className={`w-full h-10 ${icon ? "pl-9" : "pl-3"} ${suffix ? "pr-12" : "pr-3"} rounded-lg bg-white hairline text-[13.5px] text-ink-900 placeholder:text-ink-400 focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)] outline-none transition-shadow ${inputClassName}`}
    />
    {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-mono text-ink-500">{suffix}</span>}
  </div>
);

const Label = ({ children, hint, className = "" }) => (
  <div className={`text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500 ${className}`}>
    {children}
    {hint && <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-400 text-[11.5px]">· {hint}</span>}
  </div>
);

const Pill = ({ children, tone = "ink" }) => {
  const tones = {
    ink:     "bg-ink-100 text-ink-700",
    mint:    "bg-mint-100 text-mint-800",
    yellow:  "bg-amber-100 text-amber-800",
    red:     "bg-red-50 text-red-700",
    blue:    "bg-sky-50 text-sky-700",
    outline: "hairline text-ink-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-full text-[11px] font-semibold tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
};

const StatusPill = ({ status }) => {
  const map = {
    Confirmed:    { tone: "mint",   dot: "bg-mint-500" },
    Pending:      { tone: "yellow", dot: "bg-amber-500" },
    "In Progress":{ tone: "blue",   dot: "bg-sky-500" },
    Completed:    { tone: "ink",    dot: "bg-ink-500" },
    Cancelled:    { tone: "red",    dot: "bg-red-500" },
  };
  const s = map[status] || map.Pending;
  return (
    <Pill tone={s.tone}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
      {status}
    </Pill>
  );
};

const PaymentBadge = ({ booking }) => {
  if (booking.status === 'Cancelled') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-ink-100 text-ink-500">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-400"></span>
        Cancelled
      </span>
    );
  }
  const isPaid = booking.payment_status === 'Paid';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold
      ${isPaid ? 'bg-mint-100 text-mint-700' : 'bg-amber-100 text-amber-700'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-mint-500' : 'bg-amber-500'}`}></span>
      {isPaid ? 'Paid' : 'Pending'}
    </span>
  );
};

/* Admin sections: Services, Nationalities, Packages, Materials, Operations, Bookings */

/* ─────── Per-mode helpers ─────── */
const ModeHeaderCard = ({ mode, store, set }) => {
  const m = store.modes.find(x => x.id === mode);
  const [saving, setSaving] = React.useState(false);
  const [savedOk, setSavedOk] = React.useState(false);
  if (!m) return null;

  const patchMode = async (patch) => {
    const prev = store.modes;
    const newModes = store.modes.map(x => x.id === m.id ? { ...x, ...patch } : x);
    set({ modes: newModes });
    setSaving(true); setSavedOk(false);
    try {
      const { error } = await db('settings').upsert({ key: 'modes', value: newModes }, { onConflict: 'company_id,key' });
      if (error) throw error;
      broadcastSettingsUpdate();
      setSavedOk(true); setTimeout(() => setSavedOk(false), 3000);
    } catch (e) {
      set({ modes: prev });
      alert('Mode save failed: ' + (e.message || 'Network error — check your connection and try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className={`rounded-xl p-4 transition-colors ${m.on ? "bg-mint-50 hairline" : "bg-ink-50 hairline"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <IconPicker value={m.icon || 'Sparkles'} onChange={v => patchMode({ icon: v })} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-ink-900 text-[15px]">{m.name}</h4>
                <Pill tone={m.on ? "mint" : "ink"}>
                  <span className={`w-1.5 h-1.5 rounded-full ${m.on ? "bg-mint-500" : "bg-ink-400"}`}></span>
                  {m.on ? "LIVE" : "DISABLED"}
                </Pill>
                {saving && <span className="text-[11.5px] text-ink-400 font-mono">Saving…</span>}
                {savedOk && !saving && (
                  <span className="flex items-center gap-1 text-[11.5px] text-mint-700 font-semibold">
                    <AdminIcon name="check" className="w-3.5 h-3.5"/>Saved
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12.5px] text-ink-500 leading-snug">{m.desc}</p>
            </div>
          </div>
          <Switch on={m.on} onChange={v => !saving && patchMode({ on: v })} dim={saving} ariaLabel={`Toggle ${m.name}`} />
        </div>
        <div className="mt-3 pt-3 border-t border-ink-200/70 flex items-center justify-between text-[11.5px] text-ink-500">
          <span className="font-mono">{m.bookings} active bookings</span>
          <span>Toggling off hides it from the customer app.</span>
        </div>
      </div>
    </Card>
  );
};

/* ─────── Hourly Booking ─────── */
const HourlySection = ({ store, set }) => {
  const updateService = (id, p) => set({ services: store.services.map(s => s.id === id ? { ...s, ...p } : s) });
  const removeService = (id) => set({ services: store.services.filter(s => s.id !== id) });

  const fixedSvcs = store.fixedServices || [];
  const updateFixed = (id, p) => set({ fixedServices: fixedSvcs.map(s => s.id === id ? { ...s, ...p } : s) });
  const removeFixed = (id) => set({ fixedServices: fixedSvcs.filter(s => s.id !== id) });
  const addFixed = () => set({ fixedServices: [...fixedSvcs, { id: `fs${Date.now()}`, name: "New fixed service", icon: 'Sparkles', fixedPrice: 100, on: true }] });

  const [savedH, setSavedH] = React.useState(false);
  const saveHourly = async () => {
    setSavedH(false);
    try {
      const { error } = await db('settings').upsert([
        { key:'services',      value:store.services },
        { key:'fixedServices', value:fixedSvcs      },
        { key:'limits',        value:store.limits   },
      ], { onConflict: 'company_id,key' });
      if (error) throw error;
      broadcastSettingsUpdate();
      setSavedH(true); setTimeout(()=>setSavedH(false),3000);
    } catch(e) { alert('Save failed: ' + (e.message || 'Network error — check your connection.')); }
  };
  const addService = () => set({ services: [...store.services, { id: `sv${Date.now()}`, name: "New service", icon: 'Sparkles', rate: 15, on: true }] });

  return (
    <div className="space-y-5 fade-up">
      <ModeHeaderCard mode="hourly" store={store} set={set}/>

      <Card title="Hourly Service Types" subtitle="Cleaning categories shown on the customer app, with per-hour pricing."
        action={<PrimaryBtn size="sm" onClick={addService}><AdminIcon name="plus" className="w-4 h-4"/>Add service</PrimaryBtn>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {store.services.map(s => (
              <div key={s.id} className="rounded-xl hairline bg-white p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <IconPicker value={s.icon} onChange={v => updateService(s.id, { icon: v })} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <TextField value={s.name} onChange={v => updateService(s.id, { name: v })} placeholder="Service name" />
                    <div className="flex items-center justify-between rounded-lg hairline bg-ink-50 px-3 h-10">
                      <span className="text-[12px] text-ink-600 font-medium">Active</span>
                      <Switch on={s.on} onChange={v => updateService(s.id, { on: v })} ariaLabel={`Toggle ${s.name}`} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-ink-100">
                  <span className="text-[11px] font-mono text-ink-400">Default: <TextField type="number" value={s.rate} onChange={v => updateService(s.id, { rate: v })} suffix="QAR/hr" className="inline-flex w-28"/></span>
                  <IconBtn icon="trash" tone="danger" onClick={() => removeService(s.id)} />
                </div>
              </div>
          ))}
        </div>
      </Card>

      <Card title="Fixed Services" subtitle="Flat-rate services shown on the customer app — e.g. sofa cleaning, car detailing. Price is fixed regardless of hours or maids."
        action={<PrimaryBtn size="sm" onClick={addFixed}><AdminIcon name="plus" className="w-4 h-4"/>Add service</PrimaryBtn>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fixedSvcs.length === 0 && (
            <div className="col-span-2 py-8 text-center text-[13px] text-ink-400">
              No fixed-price services yet. Click "Add service" to create one.
            </div>
          )}
          {fixedSvcs.map(s => (
            <div key={s.id} className="rounded-xl hairline bg-white p-4 space-y-3">
              <div className="flex items-start gap-3">
                <IconPicker value={s.icon} onChange={v => updateFixed(s.id, { icon: v })} />
                <div className="flex-1 min-w-0 space-y-2">
                  <TextField value={s.name} onChange={v => updateFixed(s.id, { name: v })} placeholder="Service name" />
                  <div className="flex items-center justify-between rounded-lg hairline bg-ink-50 px-3 h-10">
                    <span className="text-[12px] text-ink-600 font-medium">Active</span>
                    <Switch on={s.on} onChange={v => updateFixed(s.id, { on: v })} ariaLabel={`Toggle ${s.name}`} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-ink-100">
                <span className="text-[11px] font-mono text-ink-400">Price: <TextField type="number" value={s.fixedPrice} onChange={v => updateFixed(s.id, { fixedPrice: v })} suffix="QAR flat" className="inline-flex w-32"/></span>
                <IconBtn icon="trash" tone="danger" onClick={() => removeFixed(s.id)} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Hourly Operational Limits" subtitle="Booking constraints customers must work within for hourly jobs.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Minimum Hours</Label>
            <TextField type="number" value={store.limits.minHours} onChange={v => set({ limits: { ...store.limits, minHours: v } })} suffix="hours" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Customers cannot book below this threshold.</p>
          </div>
          <div>
            <Label>Maximum Maids</Label>
            <TextField type="number" value={store.limits.maxMaids} onChange={v => set({ limits: { ...store.limits, maxMaids: v } })} suffix="maids" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Cap on simultaneous maids per booking.</p>
          </div>
          <div>
            <Label>Lead Time</Label>
            <TextField type="number" value={store.limits.leadHours} onChange={v => set({ limits: { ...store.limits, leadHours: v } })} suffix="hours" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Earliest booking from now.</p>
          </div>
          <div>
            <Label>Cancellation Window</Label>
            <TextField type="number" value={store.limits.cancelHours} onChange={v => set({ limits: { ...store.limits, cancelHours: v } })} suffix="hours" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Free cancellation up to this many hours before.</p>
          </div>
          <div>
            <Label>Max Hours / Day</Label>
            <TextField type="number" value={store.limits.maxHours} onChange={v => set({ limits: { ...store.limits, maxHours: v } })} suffix="hours" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Upper bound for a single visit.</p>
          </div>
          <div>
            <Label>Service Radius</Label>
            <TextField type="number" value={store.limits.radiusKm} onChange={v => set({ limits: { ...store.limits, radiusKm: v } })} suffix="km" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Coverage from Doha city centre.</p>
          </div>
        </div>
      </Card>
      <div className="flex items-center justify-end gap-3 border-t border-ink-200 mt-4 pt-4">
        {savedH && <span className="flex items-center gap-1.5 text-[13px] font-semibold text-mint-700"><AdminIcon name="check" className="w-4 h-4"/>Saved!</span>}
        <PrimaryBtn onClick={saveHourly}><AdminIcon name="check" className="w-4 h-4"/>Save Changes</PrimaryBtn>
      </div>
    </div>
  );
};

/* ─────── Monthly Plans ─────── */
const MonthlySection = ({ store, set }) => {
  const ms = store.monthlySettings || { autoRenew: true, noticeDays: 14, minMonths: 1, allowSkip: true, freeReschedule: 2 };
  const setMs = (p) => set({ monthlySettings: { ...ms, ...p } });
  const [savedM, setSavedM] = React.useState(false);
  const saveMonthly = async () => {
    setSavedM(false);
    try {
      const { error } = await db('settings').upsert([
        { key:'monthly',         value:store.monthly },
        { key:'monthlySettings', value:ms            }
      ], { onConflict: 'company_id,key' });
      if (error) throw error;
      broadcastSettingsUpdate();
      setSavedM(true); setTimeout(()=>setSavedM(false),3000);
    } catch(e) { alert('Save failed: ' + (e.message || 'Network error — check your connection.')); }
  };
  const updMonthly = (id, patch) => set({ monthly: store.monthly.map(p => p.id === id ? { ...p, ...patch } : p) });
  const removeMonthly = id => set({ monthly: store.monthly.filter(p => p.id !== id) });
  const addMonthly = () => set({ monthly: [...store.monthly, { id: `pkg${Date.now()}`, name: "New Package", icon: 'Sparkles', emoji: "📦", maids: 1, daysPerWeek: 4, hoursPerDay: 4, priceMonthly: 1000, discountLabel: "", nationalityRates: {} }] });

  return (
    <div className="space-y-5 fade-up">
      <ModeHeaderCard mode="monthly" store={store} set={set}/>

      <Card
        title="Monthly Package Builder"
        subtitle="Curate the monthly subscription plans with maids, days, hours and discount labels."
        action={<PrimaryBtn size="sm" onClick={addMonthly}><AdminIcon name="plus" className="w-4 h-4"/>New package</PrimaryBtn>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {store.monthly.map(p => (
            <div key={p.id} className="rounded-xl hairline bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <IconPicker value={p.icon || 'Sparkles'} onChange={v => updMonthly(p.id, { icon: v })} />

                  <div className="flex-1 min-w-0 space-y-2">
                    <TextField value={p.name} onChange={v => updMonthly(p.id, { name: v })} placeholder="Package name"/>
                    <TextField value={p.discountLabel} onChange={v => updMonthly(p.id, { discountLabel: v })} placeholder="e.g. 20% OFF, MOST POPULAR" inputClassName="text-[12.5px]"/>
                  </div>
                </div>
                <IconBtn icon="trash" tone="danger" onClick={() => removeMonthly(p.id)} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div><Label className="mb-1">Maids</Label><TextField type="number" value={p.maids} onChange={v => updMonthly(p.id, { maids: v })}/></div>
                <div><Label className="mb-1">Days/wk</Label><TextField type="number" value={p.daysPerWeek} onChange={v => updMonthly(p.id, { daysPerWeek: v })}/></div>
                <div><Label className="mb-1">Hrs/day</Label><TextField type="number" value={p.hoursPerDay} onChange={v => updMonthly(p.id, { hoursPerDay: v })}/></div>
              </div>
              <div className="mt-2"><Label className="mb-1">Default price / month</Label><TextField type="number" value={p.priceMonthly} onChange={v => updMonthly(p.id, { priceMonthly: v })} suffix="QAR"/></div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Custom Package" subtitle="Let customers build their own recurring schedule.">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg hairline bg-white px-3 py-2.5">
            <div>
              <div className="text-[13px] font-semibold text-ink-800">Show Custom Package</div>
              <div className="text-[11.5px] text-ink-500">Display the "Build your own" option in the customer booking app.</div>
            </div>
            <Switch on={ms.customEnabled !== false} onChange={v => setMs({ customEnabled: v })} ariaLabel="Toggle custom package"/>
          </div>
          <div>
            <Label>Loyalty Discount</Label>
            <TextField type="number" value={ms.customDiscount ?? 10} onChange={v => setMs({ customDiscount: Number(v) })} suffix="% off" className="mt-2"/>
            <p className="mt-1.5 text-[11.5px] text-ink-500">Discount applied automatically to all custom monthly bookings.</p>
          </div>
        </div>
      </Card>

      <Card title="Monthly Plan Settings" subtitle="Renewal, commitment and reschedule rules.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Minimum Commitment</Label>
            <TextField type="number" value={ms.minMonths} onChange={v => setMs({ minMonths: v })} suffix="months" className="mt-2"/>
            <p className="mt-1.5 text-[11.5px] text-ink-500">Customers must subscribe for at least this many months.</p>
          </div>
          <div>
            <Label>Cancellation Notice</Label>
            <TextField type="number" value={ms.noticeDays} onChange={v => setMs({ noticeDays: v })} suffix="days" className="mt-2"/>
            <p className="mt-1.5 text-[11.5px] text-ink-500">Notice required before next billing cycle.</p>
          </div>
          <div>
            <Label>Free Reschedules / month</Label>
            <TextField type="number" value={ms.freeReschedule} onChange={v => setMs({ freeReschedule: v })} suffix="visits" className="mt-2"/>
            <p className="mt-1.5 text-[11.5px] text-ink-500">Visits a customer can move without fee.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg hairline bg-white px-3 py-2.5">
              <div>
                <div className="text-[13px] font-semibold text-ink-800">Auto-renew subscriptions</div>
                <div className="text-[11.5px] text-ink-500">Renew at end of cycle unless cancelled.</div>
              </div>
              <Switch on={ms.autoRenew} onChange={v => setMs({ autoRenew: v })} ariaLabel="Auto-renew"/>
            </div>
            <div className="flex items-center justify-between rounded-lg hairline bg-white px-3 py-2.5">
              <div>
                <div className="text-[13px] font-semibold text-ink-800">Allow skip-week</div>
                <div className="text-[11.5px] text-ink-500">Customers can skip a week and shift the schedule.</div>
              </div>
              <Switch on={ms.allowSkip} onChange={v => setMs({ allowSkip: v })} ariaLabel="Allow skip"/>
            </div>
          </div>
        </div>
      </Card>
      <div className="flex items-center justify-end gap-3 border-t border-ink-200 mt-4 pt-4">
        {savedM && <span className="flex items-center gap-1.5 text-[13px] font-semibold text-mint-700"><AdminIcon name="check" className="w-4 h-4"/>Saved!</span>}
        <PrimaryBtn onClick={saveMonthly}><AdminIcon name="check" className="w-4 h-4"/>Save Changes</PrimaryBtn>
      </div>
    </div>
  );
};

/* ─────── Stay-In ─────── */
const StayInSection = ({ store, set }) => {
  const sis = store.stayinSettings || { visa: true, accommodation: true, food: true, deposit: 1, probationDays: 14, replaceWindow: 30 };
  const setSis = (p) => set({ stayinSettings: { ...sis, ...p } });
  const [savedS, setSavedS] = React.useState(false);
  const saveStayIn = async () => {
    setSavedS(false);
    try {
      const { error } = await db('settings').upsert([
        { key:'stayIn',         value:store.stayIn },
        { key:'stayinSettings', value:sis          }
      ], { onConflict: 'company_id,key' });
      if (error) throw error;
      broadcastSettingsUpdate();
      setSavedS(true); setTimeout(()=>setSavedS(false),3000);
    } catch(e) { alert('Save failed: ' + (e.message || 'Network error — check your connection.')); }
  };
  const updStay = (id, patch) => set({ stayIn: store.stayIn.map(p => p.id === id ? { ...p, ...patch } : p) });
  const removeStay = id => set({ stayIn: store.stayIn.filter(p => p.id !== id) });
  const addStay = () => set({ stayIn: [...store.stayIn, { id: `si${Date.now()}`, name: "New", icon: 'Home', months: 1, price: 5000, save: 0, notes: "", nationalityRates: {} }] });

  return (
    <div className="space-y-5 fade-up">
      <ModeHeaderCard mode="stayin" store={store} set={set}/>

      <Card
        title="Stay-In Plans"
        subtitle="Long-term live-in packages — set duration, default price, per-nationality prices and notes."
        action={<PrimaryBtn size="sm" onClick={addStay}><AdminIcon name="plus" className="w-4 h-4"/>New plan</PrimaryBtn>}
        padded={false}
      >
        <ul>
          {store.stayIn.map((p, i) => (
            <li key={p.id} className={`px-4 sm:px-6 py-4 ${i ? "border-t border-ink-200/70" : ""}`}>
              <div className="grid grid-cols-[48px_1fr_80px_100px_100px_40px] gap-2 items-start mb-3">
                <IconPicker value={p.icon || 'Home'} onChange={v => updStay(p.id, { icon: v })} />
                <TextField value={p.name} onChange={v => updStay(p.id, { name: v })} />
                <TextField type="number" value={p.months} onChange={v => updStay(p.id, { months: v })} suffix="mo" />
                <TextField type="number" value={p.price} onChange={v => updStay(p.id, { price: v })} suffix="QAR" />
                <TextField type="number" value={p.save} onChange={v => updStay(p.id, { save: v })} suffix="save" />
                <div className="flex items-center justify-end pt-1">
                  <IconBtn icon="trash" tone="danger" onClick={() => removeStay(p.id)} />
                </div>
              </div>
              <div>
                <Label className="mb-1.5">Notes</Label>
                <textarea value={p.notes} onChange={e => updStay(p.id, { notes: e.target.value })}
                  placeholder="e.g. Includes visa, accommodation, food allowance"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white hairline text-[13px] text-ink-900 placeholder:text-ink-400 focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)] outline-none resize-y"/>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Stay-In Inclusions & Policy" subtitle="What's bundled with every live-in contract.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg hairline bg-white px-3 py-2.5">
              <div>
                <div className="text-[13px] font-semibold text-ink-800">Visa & paperwork included</div>
                <div className="text-[11.5px] text-ink-500">Sponsorship and government fees handled by Maid Pro.</div>
              </div>
              <Switch on={sis.visa} onChange={v => setSis({ visa: v })} ariaLabel="Visa included"/>
            </div>
            <div className="flex items-center justify-between rounded-lg hairline bg-white px-3 py-2.5">
              <div>
                <div className="text-[13px] font-semibold text-ink-800">Accommodation provided</div>
                <div className="text-[11.5px] text-ink-500">Customer hosts the maid; lodging required.</div>
              </div>
              <Switch on={sis.accommodation} onChange={v => setSis({ accommodation: v })} ariaLabel="Accommodation"/>
            </div>
            <div className="flex items-center justify-between rounded-lg hairline bg-white px-3 py-2.5">
              <div>
                <div className="text-[13px] font-semibold text-ink-800">Food allowance</div>
                <div className="text-[11.5px] text-ink-500">Daily food allowance bundled into the plan price.</div>
              </div>
              <Switch on={sis.food} onChange={v => setSis({ food: v })} ariaLabel="Food allowance"/>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Security Deposit</Label>
              <TextField type="number" value={sis.deposit} onChange={v => setSis({ deposit: v })} suffix="months" className="mt-2"/>
              <p className="mt-1.5 text-[11.5px] text-ink-500">Refundable deposit, in months of plan price.</p>
            </div>
            <div>
              <Label>Probation Period</Label>
              <TextField type="number" value={sis.probationDays} onChange={v => setSis({ probationDays: v })} suffix="days" className="mt-2"/>
              <p className="mt-1.5 text-[11.5px] text-ink-500">Customer can request a swap within this window.</p>
            </div>
            <div>
              <Label>Replacement Window</Label>
              <TextField type="number" value={sis.replaceWindow} onChange={v => setSis({ replaceWindow: v })} suffix="days" className="mt-2"/>
              <p className="mt-1.5 text-[11.5px] text-ink-500">Time to provide a replacement maid if needed.</p>
            </div>
          </div>
        </div>
      </Card>
      <div className="flex items-center justify-end gap-3 border-t border-ink-200 mt-4 pt-4">
        {savedS && <span className="flex items-center gap-1.5 text-[13px] font-semibold text-mint-700"><AdminIcon name="check" className="w-4 h-4"/>Saved!</span>}
        <PrimaryBtn onClick={saveStayIn}><AdminIcon name="check" className="w-4 h-4"/>Save Changes</PrimaryBtn>
      </div>
    </div>
  );
};

/* ─────── Services & Operations (legacy combined) ─────── */
const ServicesSection = ({ store, set }) => {
  const updateMode = async (id, on) => {
    const prev = store.modes;
    const newModes = store.modes.map(m => m.id === id ? { ...m, on } : m);
    set({ modes: newModes });
    try {
      const { error } = await db('settings').upsert({ key: 'modes', value: newModes }, { onConflict: 'company_id,key' });
      if (error) throw error;
      broadcastSettingsUpdate();
    } catch(e) { set({ modes: prev }); alert('Save failed: ' + (e.message || 'Network error.')); }
  };
  const updateService = (id, patch) => set({ services: store.services.map(s => s.id === id ? { ...s, ...patch } : s) });

  return (
    <div className="space-y-5 fade-up">
      {/* Global Service Toggles */}
      <Card title="Global Service Modes" subtitle="Turn entire booking modes on or off across the customer app.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {store.modes.map(m => (
            <div key={m.id} className={`rounded-xl p-4 transition-colors ${m.on ? "bg-mint-50 hairline" : "bg-ink-50 hairline"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[18px]">{m.emoji}</span>
                    <h4 className="font-bold text-ink-900 text-[14px]">{m.name}</h4>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-500 leading-snug">{m.desc}</p>
                </div>
                <Switch on={m.on} onChange={v => updateMode(m.id, v)} ariaLabel={`Toggle ${m.name}`} />
              </div>
              <div className="mt-3 pt-3 border-t border-ink-200/70 flex items-center justify-between text-[11.5px] text-ink-500">
                <span className="font-mono">{m.on ? "LIVE" : "DISABLED"}</span>
                <span>{m.bookings} active</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Service Configurator */}
      <Card title="Hourly Service Configurator" subtitle="Manage names, icons and per-hour pricing for each cleaning type."
        action={<GhostBtn size="sm" tone="mint"><AdminIcon name="plus" className="w-4 h-4"/>Add service</GhostBtn>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {store.services.map(s => (
            <div key={s.id} className="rounded-xl hairline bg-white p-4">
              <div className="flex items-start gap-3">
                <input
                  value={s.emoji}
                  onChange={e => updateService(s.id, { emoji: e.target.value })}
                  className="w-12 h-12 text-center text-[26px] rounded-lg hairline bg-ink-50 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <TextField value={s.name} onChange={v => updateService(s.id, { name: v })} placeholder="Service name" />
                  <div className="grid grid-cols-2 gap-2">
                    <TextField type="number" value={s.rate} onChange={v => updateService(s.id, { rate: v })} suffix="QAR/hr" />
                    <div className="flex items-center justify-between rounded-lg hairline bg-ink-50 px-3">
                      <span className="text-[12px] text-ink-600 font-medium">Active</span>
                      <Switch on={s.on} onChange={v => updateService(s.id, { on: v })} ariaLabel={`Toggle ${s.name}`} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11.5px] font-mono text-ink-500">id: {s.id}</span>
                <div className="flex">
                  <IconBtn icon="edit" />
                  <IconBtn icon="trash" tone="danger" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Operational Limits */}
      <Card title="Operational Limits" subtitle="Set the booking constraints customers must work within.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Minimum Hours</Label>
            <TextField type="number" value={store.limits.minHours} onChange={v => set({ limits: { ...store.limits, minHours: v } })} suffix="hours" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Customers cannot book below this threshold.</p>
          </div>
          <div>
            <Label>Maximum Maids</Label>
            <TextField type="number" value={store.limits.maxMaids} onChange={v => set({ limits: { ...store.limits, maxMaids: v } })} suffix="maids" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Cap on simultaneous maids per booking.</p>
          </div>
          <div>
            <Label>Lead Time</Label>
            <TextField type="number" value={store.limits.leadHours} onChange={v => set({ limits: { ...store.limits, leadHours: v } })} suffix="hours" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Earliest booking from now.</p>
          </div>
          <div>
            <Label>Cancellation Window</Label>
            <TextField type="number" value={store.limits.cancelHours} onChange={v => set({ limits: { ...store.limits, cancelHours: v } })} suffix="hours" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Free cancellation up to this many hours before.</p>
          </div>
          <div>
            <Label>Max Hours / Day</Label>
            <TextField type="number" value={store.limits.maxHours} onChange={v => set({ limits: { ...store.limits, maxHours: v } })} suffix="hours" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Upper bound for a single visit.</p>
          </div>
          <div>
            <Label>Service Radius</Label>
            <TextField type="number" value={store.limits.radiusKm} onChange={v => set({ limits: { ...store.limits, radiusKm: v } })} suffix="km" className="mt-2" />
            <p className="mt-1.5 text-[11.5px] text-ink-500">Coverage from Doha city centre.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

/* ─────── Nationalities ─────── */
const NationalitiesSection = ({ store, set }) => {
  const [saved, setSaved] = React.useState(false);
  const [activeModes, setActiveModes] = React.useState({}); // { [natId]: 'hourly'|'monthly'|'stayin' }

  const saveBlock = async () => {
    const natsPayload = store.nationalities.map(n => ({
      id: n.id, name: n.name, flag: n.flag || '🌍', enabled: n.on !== false, rate: Number(n.rate) || 15,
    }));
    try {
      const { error: blockErr } = await db('settings').upsert(
        { key: 'nationalities_block', value: { enabled: store.nationalitiesEnabled } }, { onConflict: 'company_id,key' }
      );
      if (blockErr) throw blockErr;
      const { error: natsErr } = await db('nationalities').upsert(natsPayload, { onConflict: 'company_id,id' });
      if (natsErr) throw natsErr;
      const { error: svcErr } = await db('settings').upsert({ key: 'services', value: store.services }, { onConflict: 'company_id,key' });
      if (svcErr) throw svcErr;
      const { error: mErr } = await db('settings').upsert({ key: 'monthly', value: store.monthly }, { onConflict: 'company_id,key' });
      if (mErr) throw mErr;
      const { error: sErr } = await db('settings').upsert({ key: 'stayIn', value: store.stayIn }, { onConflict: 'company_id,key' });
      if (sErr) throw sErr;
      broadcastSettingsUpdate();
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch(e) { alert('Save failed: ' + (e.message || 'Network error — check your connection.')); }
  };

  const update = (id, patch) => {
    set({ nationalities: store.nationalities.map(n => n.id === id ? { ...n, ...patch } : n) });
    const dbPatch = { ...patch };
    if ('on' in dbPatch) { dbPatch.enabled = dbPatch.on; delete dbPatch.on; }
    db('nationalities').update(dbPatch).eq('id', id);
  };
  const remove = (id) => {
    set({ nationalities: store.nationalities.filter(n => n.id !== id) });
    db('nationalities').delete().eq('id', id);
  };
  const add = () => {
    const n = { id: 'nat_' + Date.now(), name: 'New Nationality', flag: '🌍', on: true };
    set({ nationalities: [...store.nationalities, n] });
    db('nationalities').insert({ id: n.id, name: n.name, flag: n.flag, enabled: true });
  };

  // Update a per-nationality price on a service/package/plan
  const setNatRate = (collection, itemId, natId, val) => {
    const updated = store[collection].map(item =>
      item.id === itemId
        ? { ...item, nationalityRates: { ...(item.nationalityRates || {}), [natId]: val === '' ? undefined : Number(val) } }
        : item
    );
    set({ [collection]: updated });
  };

  const COUNTRIES = [
    { iso:'ph', name:'Philippines' }, { iso:'in', name:'India' },
    { iso:'np', name:'Nepal' },       { iso:'ng', name:'Nigeria' },
    { iso:'bd', name:'Bangladesh' },  { iso:'lk', name:'Sri Lanka' },
    { iso:'id', name:'Indonesia' },   { iso:'ke', name:'Kenya' },
    { iso:'et', name:'Ethiopia' },    { iso:'gh', name:'Ghana' },
    { iso:'pk', name:'Pakistan' },    { iso:'eg', name:'Egypt' },
    { iso:'ug', name:'Uganda' },      { iso:'tz', name:'Tanzania' },
    { iso:'cm', name:'Cameroon' },    { iso:'my', name:'Malaysia' },
    { iso:'th', name:'Thailand' },    { iso:'vn', name:'Vietnam' },
    { iso:'af', name:'Afghanistan' }, { iso:'ma', name:'Morocco' },
    { iso:'sd', name:'Sudan' },       { iso:'so', name:'Somalia' },
    { iso:'mx', name:'Mexico' },      { iso:'mm', name:'Myanmar' },
  ];

  const MODE_TABS = [
    { id: 'hourly',  label: 'Hourly',   icon: 'broom'    },
    { id: 'monthly', label: 'Monthly',  icon: 'calendar' },
    { id: 'stayin',  label: 'Stay-In',  icon: 'home'     },
  ];

  return (
    <div className="space-y-5 fade-up">
      <Card
        title="Nationality Manager"
        subtitle="Enable nationalities, set which service types they apply to, and configure per-service pricing."
        action={
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[12px] text-ink-600">
              <span className="font-medium">Block</span>
              <Switch on={store.nationalitiesEnabled} onChange={v => set({ nationalitiesEnabled: v })} ariaLabel="Toggle nationality block"/>
              <span className={`font-mono text-[11px] ${store.nationalitiesEnabled ? "text-mint-700" : "text-ink-500"}`}>
                {store.nationalitiesEnabled ? "ON" : "OFF"}
              </span>
            </div>
            <PrimaryBtn size="sm" onClick={add}><AdminIcon name="plus" className="w-4 h-4"/>Add</PrimaryBtn>
          </div>
        }
      >
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${store.nationalitiesEnabled ? "" : "opacity-60"}`}>
          {store.nationalities.map(n => {
            const mode = activeModes[n.id] || 'hourly';
            return (
              <div key={n.id} className="rounded-xl hairline bg-ink-50 p-4 space-y-3">
                {/* Header: country dropdown (auto-fills flag) + active + delete */}
                <div className="flex items-center gap-3">
                  {/* Flag preview */}
                  <div className="w-12 h-10 rounded-lg hairline bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Flag code={n.flag} size={32}/>
                  </div>
                  {/* Country dropdown */}
                  <select
                    value={toISO(n.flag) || ''}
                    onChange={e => {
                      const c = COUNTRIES.find(x => x.iso === e.target.value);
                      if (c) update(n.id, { flag: c.iso, name: c.name });
                    }}
                    className="flex-1 h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
                    <option value="">— Choose country —</option>
                    {COUNTRIES.map(c => (
                      <option key={c.iso} value={c.iso}>{c.name}</option>
                    ))}
                  </select>
                  <Switch on={n.on !== false} onChange={v => update(n.id, { on: v })} ariaLabel={`Toggle ${n.name}`}/>
                  <IconBtn icon="trash" tone="danger" onClick={() => remove(n.id)}/>
                </div>

                {/* Mode tabs */}
                <div className="grid grid-cols-3 gap-1">
                  {MODE_TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveModes(m => ({ ...m, [n.id]: t.id }))}
                      className={`h-8 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all
                        ${mode === t.id ? "bg-ink-900 text-white" : "bg-white hairline text-ink-600 hover:bg-ink-100"}`}>
                      <AdminIcon name={t.icon} className="w-3.5 h-3.5"/>{t.label}
                    </button>
                  ))}
                </div>

                {/* Pricing inputs for selected mode */}
                <div className="space-y-1.5">
                  {mode === 'hourly' && store.services.filter(s => s.on !== false).map(s => (
                    <div key={s.id} className="flex items-center gap-2 h-9 px-2.5 rounded-lg bg-white hairline">
                      <span className="text-[13px] flex-1 text-ink-700 truncate">{s.name}</span>
                      <input type="number" min="0"
                        value={(s.nationalityRates || {})[n.id] ?? ''}
                        placeholder={String(s.rate || 15)}
                        onChange={e => setNatRate('services', s.id, n.id, e.target.value)}
                        className="w-20 text-right text-[13px] font-mono bg-ink-50 rounded-md px-2 h-7 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
                      <span className="text-[11px] text-ink-400 flex-shrink-0 w-12">QAR/hr</span>
                    </div>
                  ))}
                  {mode === 'monthly' && store.monthly.filter(p => !p.custom).map(p => (
                    <div key={p.id} className="flex items-center gap-2 h-9 px-2.5 rounded-lg bg-white hairline">
                      <span className="text-[13px] flex-1 text-ink-700 truncate">{p.name}</span>
                      <input type="number" min="0"
                        value={(p.nationalityRates || {})[n.id] ?? ''}
                        placeholder={String(p.priceMonthly || '')}
                        onChange={e => setNatRate('monthly', p.id, n.id, e.target.value)}
                        className="w-20 text-right text-[13px] font-mono bg-ink-50 rounded-md px-2 h-7 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
                      <span className="text-[11px] text-ink-400 flex-shrink-0 w-12">QAR/mo</span>
                    </div>
                  ))}
                  {mode === 'stayin' && store.stayIn.map(p => (
                    <div key={p.id} className="flex items-center gap-2 h-9 px-2.5 rounded-lg bg-white hairline">
                      <span className="text-[13px] flex-1 text-ink-700 truncate">{p.name}</span>
                      <input type="number" min="0"
                        value={(p.nationalityRates || {})[n.id] ?? ''}
                        placeholder={String(p.price || '')}
                        onChange={e => setNatRate('stayIn', p.id, n.id, e.target.value)}
                        className="w-20 text-right text-[13px] font-mono bg-ink-50 rounded-md px-2 h-7 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
                      <span className="text-[11px] text-ink-400 flex-shrink-0 w-12">QAR</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="flex items-center justify-end gap-3 border-t border-ink-200 mt-4 pt-4">
        {saved && <span className="flex items-center gap-1.5 text-[13px] font-semibold text-mint-700"><AdminIcon name="check" className="w-4 h-4"/>Saved!</span>}
        <PrimaryBtn onClick={saveBlock}><AdminIcon name="check" className="w-4 h-4"/>Save Changes</PrimaryBtn>
      </div>
    </div>
  );
};

/* ─────── Packages (Monthly + Stay-In) ─────── */
const PackagesSection = ({ store, set }) => {
  const updMonthly = (id, patch) => set({ monthly: store.monthly.map(p => p.id === id ? { ...p, ...patch } : p) });
  const removeMonthly = id => set({ monthly: store.monthly.filter(p => p.id !== id) });
  const addMonthly = () => set({
    monthly: [...store.monthly, { id: `pkg${Date.now()}`, name: "New Package", emoji: "📦", maids: 1, daysPerWeek: 4, hoursPerDay: 4, priceMonthly: 1000, discountLabel: "" }]
  });

  const updStay = (id, patch) => set({ stayIn: store.stayIn.map(p => p.id === id ? { ...p, ...patch } : p) });
  const removeStay = id => set({ stayIn: store.stayIn.filter(p => p.id !== id) });
  const addStay = () => set({
    stayIn: [...store.stayIn, { id: `si${Date.now()}`, name: "New", icon: 'Home', months: 1, price: 5000, save: 0, notes: "" }]
  });

  return (
    <div className="space-y-5 fade-up">
      {/* Monthly */}
      <Card
        title="Monthly Package Builder"
        subtitle="Curate the monthly subscription plans with maids, days, hours and discount labels."
        action={<PrimaryBtn size="sm" onClick={addMonthly}><AdminIcon name="plus" className="w-4 h-4"/>New package</PrimaryBtn>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {store.monthly.map(p => (
            <div key={p.id} className="rounded-xl hairline bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <IconPicker value={p.icon || 'Sparkles'} onChange={v => updMonthly(p.id, { icon: v })} />

                  <div className="flex-1 min-w-0 space-y-2">
                    <TextField value={p.name} onChange={v => updMonthly(p.id, { name: v })} placeholder="Package name"/>
                    <TextField value={p.discountLabel} onChange={v => updMonthly(p.id, { discountLabel: v })} placeholder="e.g. 20% OFF, MOST POPULAR" inputClassName="text-[12.5px]"/>
                  </div>
                </div>
                <IconBtn icon="trash" tone="danger" onClick={() => removeMonthly(p.id)} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div><Label className="mb-1">Maids</Label><TextField type="number" value={p.maids} onChange={v => updMonthly(p.id, { maids: v })}/></div>
                <div><Label className="mb-1">Days/wk</Label><TextField type="number" value={p.daysPerWeek} onChange={v => updMonthly(p.id, { daysPerWeek: v })}/></div>
                <div><Label className="mb-1">Hrs/day</Label><TextField type="number" value={p.hoursPerDay} onChange={v => updMonthly(p.id, { hoursPerDay: v })}/></div>
              </div>
              <div className="mt-2"><Label className="mb-1">Price / month</Label><TextField type="number" value={p.priceMonthly} onChange={v => updMonthly(p.id, { priceMonthly: v })} suffix="QAR"/></div>
            </div>
          ))}
        </div>
      </Card>

      {/* Stay-In */}
      <Card
        title="Stay-In Plans"
        subtitle="Long-term live-in packages — set duration, total price, savings and customer-facing notes."
        action={<PrimaryBtn size="sm" onClick={addStay}><AdminIcon name="plus" className="w-4 h-4"/>New plan</PrimaryBtn>}
        padded={false}
      >
        <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_2fr_64px] gap-3 px-6 py-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-200/70 bg-ink-50/50">
          <div>Plan name</div><div>Months</div><div>Price</div><div>Savings</div><div>Notes</div><div></div>
        </div>
        <ul>
          {store.stayIn.map((p, i) => (
            <li key={p.id} className={`px-4 sm:px-6 py-3 ${i ? "border-t border-ink-200/70" : ""}`}>
              <div className="grid grid-cols-1 md:grid-cols-[48px_1.2fr_0.8fr_1fr_0.8fr_2fr_64px] gap-3 items-start">
                <IconPicker value={p.icon || 'Home'} onChange={v => updStay(p.id, { icon: v })} />
                <TextField value={p.name} onChange={v => updStay(p.id, { name: v })} />
                <TextField type="number" value={p.months} onChange={v => updStay(p.id, { months: v })} suffix="mo" />
                <TextField type="number" value={p.price} onChange={v => updStay(p.id, { price: v })} suffix="QAR" />
                <TextField type="number" value={p.save} onChange={v => updStay(p.id, { save: v })} suffix="QAR" />
                <textarea value={p.notes} onChange={e => updStay(p.id, { notes: e.target.value })}
                  placeholder="e.g. Includes visa, accommodation, food allowance"
                  className="w-full min-h-10 px-3 py-2 rounded-lg bg-white hairline text-[13px] text-ink-900 placeholder:text-ink-400 focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)] outline-none resize-y"/>
                <div className="flex items-center justify-end">
                  <IconBtn icon="trash" tone="danger" onClick={() => removeStay(p.id)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

/* ─────── Materials & Add-ons ─────── */
const MaterialsSection = ({ store, set }) => {
  const updItem = (i, v) => {
    const next = [...store.materialsList]; next[i] = v;
    set({ materialsList: next });
  };
  const removeItem = i => set({ materialsList: store.materialsList.filter((_, j) => j !== i) });
  const addItem = () => set({ materialsList: [...store.materialsList, "New item"] });
  const [savedMat, setSavedMat] = React.useState(false);
  const saveMaterials = async () => {
    setSavedMat(false);
    try {
      const { error } = await db('settings').upsert([
        { key:'materials', value:{ rate:store.materialsRate, enabled:store.materialsEnabled, items:store.materialsList } }
      ], { onConflict: 'company_id,key' });
      if (error) throw error;
      broadcastSettingsUpdate();
      setSavedMat(true); setTimeout(()=>setSavedMat(false),3000);
    } catch(e) { alert('Save failed: ' + (e.message || 'Network error — check your connection.')); }
  };

  return (
    <div className="space-y-5 fade-up">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Cleaning Materials" subtitle="Optional add-on; price applied per hour of service.">
          <div className="space-y-3">
            <div>
              <Label>Per-Hour Price</Label>
              <TextField type="number" value={store.materialsRate} onChange={v => set({ materialsRate: v })} suffix="QAR/hr" className="mt-2"/>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-ink-50 hairline px-3 py-2.5">
              <div>
                <div className="text-[12.5px] font-semibold text-ink-800">Show on customer app</div>
                <div className="text-[11.5px] text-ink-500">Allow customers to opt in.</div>
              </div>
              <Switch on={store.materialsEnabled} onChange={v => set({ materialsEnabled: v })} ariaLabel="Toggle materials" />
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2"
          title="Items Provided"
          subtitle="What customers get when they enable cleaning materials."
          action={<GhostBtn size="sm" tone="mint" onClick={addItem}><AdminIcon name="plus" className="w-4 h-4"/>Add item</GhostBtn>}
        >
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {store.materialsList.map((it, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg hairline bg-white pl-3 pr-1.5 py-1.5">
                <span className="w-6 h-6 grid place-items-center rounded-md bg-mint-100 text-mint-700 flex-shrink-0">
                  <AdminIcon name="check" className="w-3.5 h-3.5" strokeWidth={2.4}/>
                </span>
                <input value={it} onChange={e => updItem(i, e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-[13.5px] text-ink-800 outline-none"/>
                <IconBtn icon="trash" tone="danger" onClick={() => removeItem(i)}/>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-ink-200 mt-4 pt-4">
        {savedMat && <span className="flex items-center gap-1.5 text-[13px] font-semibold text-mint-700"><AdminIcon name="check" className="w-4 h-4"/>Saved!</span>}
        <PrimaryBtn onClick={saveMaterials}><AdminIcon name="check" className="w-4 h-4"/>Save Changes</PrimaryBtn>
      </div>
    </div>
  );
};

/* ─── Assign-staff dropdown for booking rows ─── */
const AssignStaff = ({ booking, store, set }) => {
  const [open, setOpen] = React.useState(false);
  const [dropPos, setDropPos] = React.useState({ top: 0, left: 0 });
  const [conflictErr, setConflictErr] = React.useState('');
  const ref = React.useRef(null);

  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleToggle = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const dropH = 288; // max-h-72
      const dropW = 256; // w-64
      const top = (window.innerHeight - r.bottom < dropH + 8)
        ? Math.max(8, r.top - dropH - 4)
        : r.bottom + 4;
      const left = Math.min(r.right - dropW, window.innerWidth - dropW - 8);
      setDropPos({ top, left: Math.max(8, left) });
    }
    setConflictErr('');
    setOpen(o => !o);
  };
  const assigned = (store?.assignments?.[booking.ref]) || [];
  const toggle = async (id) => {
    if (!set || !store) return;
    const has = assigned.includes(id);
    // All maids work the full booking duration simultaneously — no splitting
    const totalHours = Number(booking._raw?.hours ?? booking.hours ?? 4);
    // Bulletproof double-booking guard: when ADDING a maid, never let them be
    // assigned to a booking that overlaps another job they already have on the
    // same date. (Removing is always allowed.)
    if (!has) {
      const conflict = await hasTimeConflict(supabase, {
        maidId: id,
        date: booking._raw?.date,
        startTime: booking._raw?.time || booking.time,
        durationHours: totalHours,
        companyId: getScopedCompany(),
        excludeBookingId: booking._raw?.id ?? null,
      });
      if (conflict) {
        const staffName = (store?.staff || []).find(s => s.id === id)?.name || 'This maid';
        setConflictErr(`${staffName} is already booked ${conflict.range} (Ref ${conflict.ref}). Choose another maid or time.`);
        return;
      }
    }
    setConflictErr('');
    const next = has ? assigned.filter(x => x !== id) : [...assigned, id];
    const newStaffHours = Object.fromEntries(next.map(sid => [sid, totalHours]));
    set({
      assignments: { ...(store.assignments || {}), [booking.ref]: next },
      staffHours:  { ...(store.staffHours  || {}), [booking.ref]: newStaffHours },
    });
    if (booking._raw?.id) {
      await db('bookings').update({
        assigned_staff: next,
        staff_hours:    newStaffHours,
      }).eq('id', booking._raw.id);
    }
  };
  const assignedStaff = assigned.map(id => (store?.staff || []).find(s => s.id === id)).filter(Boolean);
  return (
    <div className="relative" ref={ref}>
      <button onClick={handleToggle}
        className="flex items-center gap-1.5 h-8 px-2 rounded-lg hairline bg-white hover:bg-ink-50 text-[12.5px] text-ink-800">
        {assignedStaff.length === 0 ? (
          <span className="text-ink-500 italic">Unassigned</span>
        ) : (
          <>
            <div className="flex -space-x-1.5">
              {assignedStaff.slice(0,3).map(s => <StaffAvatar key={s.id} s={s} size={22}/>)}
            </div>
            {assignedStaff.length > 3 && <span className="font-mono text-[11px] text-ink-500">+{assignedStaff.length - 3}</span>}
          </>
        )}
        <AdminIcon name="chevron" className="w-3.5 h-3.5 text-ink-500"/>
      </button>
      {open && (
        <div
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999, width: 256 }}
          className="rounded-xl bg-white shadow-xl ring-1 ring-ink-200 p-1.5 max-h-72 overflow-y-auto">
          <div className="px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">Assign maids</div>
          {conflictErr && (
            <div className="mx-1.5 mb-1.5 px-2.5 py-2 rounded-lg bg-red-50 ring-1 ring-red-200 text-[11.5px] font-medium text-red-700 leading-snug">
              {conflictErr}
            </div>
          )}
          {(store?.staff || []).map(s => {
            const on = assigned.includes(s.id);
            const bookingDate = booking._raw?.date || '';
            const dayOff = bookingDate ? !isWorkingDay(s, bookingDate) : false;
            const wdays = s.working_days;
            const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];
            const workDays = Array.isArray(wdays) && wdays.length > 0
              ? wdays.map(d => dayNames[d]).join(' · ')
              : 'All days';
            return (
              <button key={s.id}
                onClick={() => { if (!dayOff) toggle(s.id); }}
                disabled={dayOff && !on}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-[12.5px]
                  ${dayOff && !on ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ink-50 cursor-pointer'}
                  ${on ? 'bg-mint-50' : ''}`}>
                <StaffAvatar s={s} size={26}/>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-900 truncate flex items-center gap-1.5">
                    {dayOff && (
                      <span className="inline-flex items-center text-[9.5px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                        Day Off
                      </span>
                    )}
                    {s.name}
                  </div>
                  <div className="text-[10.5px] text-ink-500">{workDays}</div>
                </div>
                {on && <AdminIcon name="check" className="w-4 h-4 text-mint-700"/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─────── Bookings table ─────── */
const BookingsSection = ({ bookings, store, set, externalQuery, externalPayFilter, onPayFilterChange }) => {
  const [filter, setFilter] = React.useState("All");
  const [localPayFilter, setLocalPayFilter] = React.useState("All");
  const [query, setQuery] = React.useState("");
  const [detailBooking, setDetailBooking] = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);
  // Pagination — reveal rows in pages so the list scales as bookings grow.
  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  // ── Date filter state ─────────────────────────────────────────────────────
  const todayISO  = React.useMemo(() => new Date().toISOString().split('T')[0], []);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo,   setDateTo]   = React.useState('');
  const [calOpen,  setCalOpen]  = React.useState(false);
  const [calView,  setCalView]  = React.useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() };
  });
  const effectiveQuery      = externalQuery      !== undefined ? externalQuery      : query;
  const effectivePayFilter  = externalPayFilter  !== undefined ? externalPayFilter  : localPayFilter;
  const handlePayFilter = (f) => {
    if (onPayFilterChange) onPayFilterChange(f); else setLocalPayFilter(f);
  };
  const clearDate = () => { setDateFrom(''); setDateTo(''); };

  const setQuick = (from, to) => {
    setDateFrom(from); setDateTo(to || from); setCalOpen(false);
  };

  const goToday = () => setQuick(todayISO);

  const goYesterday = () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    setQuick(d.toISOString().split('T')[0]);
  };

  const goThisWeek = () => {
    const d = new Date(); d.setHours(0,0,0,0);
    const mon = new Date(d); mon.setDate(d.getDate() - (d.getDay() + 6) % 7);
    setQuick(mon.toISOString().split('T')[0], todayISO);
  };

  const goThisMonth = () => {
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    setQuick(first.toISOString().split('T')[0], todayISO);
  };

  // Calendar day click: first click = single day; second on different = range; second on same = clear
  const handleCalDay = (ds) => {
    if (!dateFrom) {
      setDateFrom(ds); setDateTo(ds);
    } else if (dateFrom === dateTo) {
      if (ds === dateFrom) { clearDate(); }
      else if (ds < dateFrom) { setDateTo(dateFrom); setDateFrom(ds); }
      else { setDateTo(ds); }
    } else {
      setDateFrom(ds); setDateTo(ds);
    }
  };

  const exportCSV = () => {
    const cols = ['ref','customer','phone','service','mode','date','time','maids','hours','total','payment_status','status']
    const rows = filtered.map(b => cols.map(c => JSON.stringify(b[c]!=null?b[c]:'')).join(','))
    const csv = [cols.join(','), ...rows].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = 'bookings-'+new Date().toISOString().slice(0,10)+'.csv'; a.click()
  }

  const filtered = bookings.filter(b => {
    if (filter !== "All" && b.status !== filter) return false;
    if (effectivePayFilter !== "All" && b.payment_status !== effectivePayFilter) return false;
    if (effectiveQuery) {
      const q = effectiveQuery.toLowerCase();
      const hit = b.customer?.toLowerCase().includes(q) || b.ref?.toLowerCase().includes(q) || (b.phone && b.phone.replace(/\s/g,'').includes(q.replace(/\s/g,'')));
      if (!hit) return false;
    }
    const raw = b._raw?.date || '';
    if (dateFrom && raw < dateFrom) return false;
    if (dateTo   && raw > dateTo)   return false;
    return true;
  });
  // Reset pagination whenever the filter criteria change (not on every poll refetch).
  React.useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filter, effectivePayFilter, effectiveQuery, dateFrom, dateTo]);
  const shown = filtered.slice(0, visibleCount);
  const dateLabel = dateFrom
    ? (dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`)
    : '';

  const filters    = ["All", "Pending", "Confirmed", "Completed", "Cancelled"];
  const payFilters = ["All", "Paid", "Pending"];

  return (
    <>
    <Card
      title={`Bookings · ${filtered.length}${dateLabel ? `  ·  ${dateLabel}` : ''}`}
      subtitle="Recent jobs across all service modes. Click a row to inspect."
      padded={false}
      action={
        <div className="flex items-center gap-2">
          <GhostBtn size="sm" onClick={exportCSV}><AdminIcon name="download" className="w-4 h-4"/>Export CSV</GhostBtn>
          <PrimaryBtn size="sm" onClick={() => setShowNew(true)}><AdminIcon name="plus" className="w-4 h-4"/>New booking</PrimaryBtn>
        </div>
      }
    >
      {/* filter bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-ink-200/70 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 sm:pb-0">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 h-8 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-colors
                  ${filter === f ? "bg-ink-900 text-white" : "hairline text-ink-700 hover:bg-ink-100"}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="sm:ml-auto sm:w-72">
            <TextField icon="search" value={query} onChange={setQuery} placeholder="Search ref or customer…"/>
          </div>
        </div>
        {/* Payment filter row */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400 whitespace-nowrap">Payment:</span>
          <div className="flex items-center gap-1.5">
            {payFilters.map(f => (
              <button key={f} onClick={() => handlePayFilter(f)}
                className={`px-3 h-7 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors
                  ${effectivePayFilter === f
                    ? f === 'Paid'    ? 'bg-mint-600 text-white'
                    : f === 'Pending' ? 'bg-amber-500 text-white'
                    :                   'bg-ink-900 text-white'
                    : 'hairline text-ink-600 hover:bg-ink-100'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Date filter row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400 whitespace-nowrap">Date:</span>
          {[
            { label: 'All',        active: !dateFrom,                                            fn: () => { clearDate(); setCalOpen(false); } },
            { label: 'Today',      active: dateFrom === todayISO && dateTo === todayISO,          fn: goToday },
            { label: 'Yesterday',  active: (() => { const d=new Date(); d.setDate(d.getDate()-1); const s=d.toISOString().split('T')[0]; return dateFrom===s&&dateTo===s; })(), fn: goYesterday },
            { label: 'This week',  active: false, fn: goThisWeek },
            { label: 'This month', active: false, fn: goThisMonth },
          ].map(({ label, active, fn }) => (
            <button key={label} onClick={fn}
              className={`px-3 h-7 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors
                ${active ? 'bg-ink-900 text-white' : 'hairline text-ink-600 hover:bg-ink-100'}`}>
              {label}
            </button>
          ))}
          <button
            onClick={() => setCalOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 h-7 rounded-full text-[12px] font-semibold transition-colors ml-auto
              ${calOpen || (dateFrom && dateFrom !== todayISO) ? 'bg-ink-900 text-white' : 'hairline text-ink-600 hover:bg-ink-100'}`}>
            <AdminIcon name="calendar" className="w-3.5 h-3.5"/>
            {dateLabel && dateFrom !== todayISO ? dateLabel : 'Calendar'}
          </button>
        </div>
      </div>

      {/* ── Inline calendar panel ── */}
      {calOpen && (
        <div className="px-4 sm:px-6 py-4 border-b border-ink-200/70 bg-ink-50/50">
          <div className="flex flex-col sm:flex-row gap-5">

            {/* Month grid */}
            <div className="flex-1 min-w-0">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCalView(v => { const d=new Date(v.year,v.month-1,1); return {year:d.getFullYear(),month:d.getMonth()}; })}
                  className="w-7 h-7 rounded-lg hover:bg-ink-200 grid place-items-center text-ink-600">
                  <AdminIcon name="arrow-left" className="w-3.5 h-3.5"/>
                </button>
                <span className="text-[13.5px] font-bold text-ink-900 tabular-nums">
                  {['January','February','March','April','May','June','July','August','September','October','November','December'][calView.month]}{' '}{calView.year}
                </span>
                <button
                  onClick={() => setCalView(v => { const d=new Date(v.year,v.month+1,1); return {year:d.getFullYear(),month:d.getMonth()}; })}
                  className="w-7 h-7 rounded-lg hover:bg-ink-200 grid place-items-center text-ink-600">
                  <AdminIcon name="arrow-right" className="w-3.5 h-3.5"/>
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
                  <div key={d} className="h-6 flex items-center justify-center text-[10px] font-bold tracking-[0.1em] text-ink-400">{d}</div>
                ))}
              </div>

              {/* Date cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {(() => {
                  const {year, month} = calView;
                  const firstDow  = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
                  const daysInMo  = new Date(year, month + 1, 0).getDate();
                  const bkDates   = new Set(bookings.map(b => b._raw?.date).filter(Boolean));
                  const cells     = [];

                  for (let i = 0; i < firstDow; i++) cells.push(<div key={`e${i}`}/>);

                  for (let d = 1; d <= daysInMo; d++) {
                    const ds    = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                    const isTd  = ds === todayISO;
                    const hasBk = bkDates.has(ds);
                    const isFr  = ds === dateFrom;
                    const isTo2 = ds === dateTo;
                    const inRng = dateFrom && dateTo && ds >= dateFrom && ds <= dateTo;
                    const isSel = isFr || isTo2;

                    cells.push(
                      <button key={ds} onClick={() => handleCalDay(ds)}
                        className={`relative h-9 w-full rounded-lg text-[12.5px] font-semibold transition-colors flex flex-col items-center justify-center
                          ${isSel  ? 'bg-ink-900 text-white shadow-sm'
                          : inRng  ? 'bg-mint-100 text-mint-900'
                          : isTd   ? 'ring-2 ring-mint-500 text-ink-900 hover:bg-mint-50'
                          :          'text-ink-700 hover:bg-ink-100'}`}>
                        {d}
                        {hasBk && (
                          <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full
                            ${isSel ? 'bg-white/70' : 'bg-mint-500'}`}/>
                        )}
                      </button>
                    );
                  }
                  return cells;
                })()}
              </div>

              <p className="mt-2 text-[11px] text-ink-400">
                Click a day to select · click a second day to set a range · click same day to clear
              </p>
            </div>

            {/* Right panel: selection summary + stats */}
            <div className="sm:w-44 flex flex-col gap-3 flex-shrink-0">
              <div className="rounded-xl bg-white hairline p-3.5 space-y-2">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-500">Selection</div>
                {dateFrom ? (
                  <>
                    <div className="space-y-0.5">
                      <div className="text-[11px] text-ink-400">From</div>
                      <div className="text-[13px] font-mono font-bold text-ink-900">{dateFrom}</div>
                    </div>
                    {dateTo !== dateFrom && (
                      <div className="space-y-0.5">
                        <div className="text-[11px] text-ink-400">To</div>
                        <div className="text-[13px] font-mono font-bold text-ink-900">{dateTo}</div>
                      </div>
                    )}
                    <div className="pt-1 border-t border-ink-100 text-[12.5px] font-semibold text-mint-700">
                      {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-[11.5px] text-ink-500">
                      QAR {filtered.filter(b => !isCancelledBooking(b)).reduce((s,b)=>s+b.total,0).toLocaleString()} total
                    </div>
                  </>
                ) : (
                  <div className="text-[12px] text-ink-400">No range selected</div>
                )}
              </div>

              <button onClick={goToday}
                className="h-8 rounded-lg bg-mint-500 hover:bg-mint-400 text-ink-900 text-[12.5px] font-semibold transition-colors">
                Jump to Today
              </button>
              {dateFrom && (
                <button onClick={clearDate}
                  className="h-8 rounded-lg hairline text-[12.5px] font-semibold text-red-600 hover:bg-red-50 transition-colors">
                  Clear Range
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 bg-ink-50/40">
              <th className="px-6 py-3 w-32">Ref ID</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Service</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Maids</th>
              <th className="px-3 py-3">Assigned to</th>
              <th className="px-3 py-3">Payment</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-6 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(b => (
              <tr key={b.ref} className="row-hover border-t border-ink-200/70">
                <td className="px-6 py-3.5">
                  <span className="font-mono tabular-nums text-[12.5px] text-ink-700">{b.ref}</span>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-mint-100 text-mint-800 grid place-items-center text-[12px] font-bold">
                      {b.customer.split(" ").map(s => s[0]).slice(0,2).join("")}
                    </div>
                    <div>
                      <div className="text-[13.5px] font-semibold text-ink-900">{b.customer}</div>
                      <div className="text-[11.5px] font-mono text-ink-500">{b.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <div className="text-[13px] text-ink-800">{b.service}</div>
                  <div className="text-[11.5px] text-ink-500">{b.mode}</div>
                </td>
                <td className="px-3 py-3.5 text-[13px] text-ink-700">{b.date}<div className="text-[11.5px] text-ink-500">{b.time}</div></td>
                <td className="px-3 py-3.5"><StatusPill status={b.status}/></td>
                <td className="px-3 py-3.5 text-[13px] font-mono tabular-nums text-ink-700">{b.maids} × {b.hours}h</td>
                <td className="px-3 py-3.5"><AssignStaff booking={b} store={store} set={set}/></td>
                <td className="px-3 py-3.5"><PaymentBadge booking={b}/></td>
                <td className="px-3 py-3.5 text-right">
                  <div className="font-mono tabular-nums text-[13.5px] font-semibold text-ink-900">
                    <span className="text-ink-500 mr-1 text-[10px]">QAR</span>{b.total.toLocaleString()}
                  </div>
                  {b.payment_status === 'Pending' && b.total > 0 && b.status !== 'Cancelled' && (
                    <div className="text-[11px] font-mono text-amber-600">
                      Due: QAR {Math.max(0, b.total - b.paid_amount).toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="px-6 py-3.5">
                  <IconBtn icon="chevron" onClick={() => setDetailBooking(b)}/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <ul className="md:hidden divide-y divide-ink-100">
        {shown.map(b => {
          const assignedIds   = (store?.assignments?.[b.ref]) || [];
          const assignedStaff = assignedIds.map(id => (store?.staff || []).find(s => s.id === id)).filter(Boolean);
          const due           = Math.max(0, b.total - (b.paid_amount || 0));
          const isPaid        = b.payment_status === 'Paid' || due === 0;

          return (
            <li key={b.ref}>
              <button
                onClick={() => setDetailBooking(b)}
                className="w-full text-left px-4 py-4 hover:bg-ink-50/60 active:bg-ink-100 transition-colors">

                {/* Row 1: avatar + name + ref + total */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-mint-100 text-mint-800 grid place-items-center text-[13px] font-bold flex-shrink-0">
                    {b.customer.split(' ').map(s => s[0]).slice(0,2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14.5px] text-ink-900 truncate">{b.customer}</div>
                    <div className="text-[11.5px] font-mono text-ink-400">{b.ref} · {b.phone}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono font-bold text-[15px] text-ink-900">QAR {b.total.toLocaleString()}</div>
                    <div className="text-[11px] font-mono text-ink-400">{b.maids}×{b.hours}h</div>
                  </div>
                </div>

                {/* Row 2: service + date + time */}
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-100 text-[11.5px] font-semibold text-ink-700">
                    {b.service}
                  </span>
                  <span className="text-[12px] text-ink-500 font-mono">{b.date}{b.time ? ` · ${b.time}` : ''}</span>
                </div>

                {/* Row 3: status + payment */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <StatusPill status={b.status}/>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold
                    ${isPaid ? 'bg-mint-100 text-mint-700' : 'bg-amber-100 text-amber-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-mint-500' : 'bg-amber-500'}`}/>
                    {isPaid ? 'Paid' : `Due QAR ${due.toLocaleString()}`}
                  </span>
                </div>

                {/* Row 4: assigned staff */}
                <div className="mt-2.5 flex items-center gap-2">
                  {assignedStaff.length === 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11.5px] font-semibold text-amber-700">
                      <AdminIcon name="users" className="w-3.5 h-3.5"/>
                      Unassigned — tap to assign
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {assignedStaff.slice(0,4).map(s => <StaffAvatar key={s.id} s={s} size={24}/>)}
                      </div>
                      <span className="text-[12px] text-ink-600 font-medium">
                        {assignedStaff.length === 1 ? assignedStaff[0].name : `${assignedStaff.length} maids assigned`}
                      </span>
                    </div>
                  )}
                  <AdminIcon name="chevron" className="w-4 h-4 text-ink-300 ml-auto flex-shrink-0 -rotate-90"/>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {filtered.length > shown.length && (
        <div className="px-6 py-4 flex items-center justify-center gap-3 border-t border-ink-100">
          <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            className="h-9 px-4 rounded-lg bg-ink-100 hover:bg-ink-200 text-[13px] font-semibold text-ink-700 transition-colors">
            Show more
          </button>
          <button onClick={() => setVisibleCount(filtered.length)}
            className="h-9 px-3 rounded-lg text-[13px] font-semibold text-mint-700 hover:bg-mint-50 transition-colors">
            Show all
          </button>
          <span className="text-[12px] text-ink-500">Showing {shown.length} of {filtered.length}</span>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="px-6 py-16 text-center">
          <div className="text-[14px] font-semibold text-ink-700">No bookings match.</div>
          <div className="text-[12.5px] text-ink-500 mt-1">Try a different filter or clear the search.</div>
        </div>
      )}
    </Card>
    {detailBooking && <BookingDetailModal booking={detailBooking} store={store} set={set} onClose={ok => { setDetailBooking(null); if(ok) window.dispatchEvent(new Event('refreshBookings')) }}/>}
    {showNew && <NewBookingModal store={store} onClose={ok => { setShowNew(false); if(ok) window.dispatchEvent(new Event('refreshBookings')) }}/>}
    </>
  );
};

/* ─────── Overview KPI tiles ─────── */
const OverviewSection = ({ store, set, kpis, bookings }) => (
  <div className="space-y-5 fade-up">
    <OverviewCharts bookings={bookings}/>
    {/* KPI tiles */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {kpis.map(k => (
        <div key={k.label}
          onClick={k.onClick}
          className={`bg-white rounded-xl2 hairline shadow-card p-4 sm:p-5
            ${k.onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-px transition-all' : ''}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">{k.label}</span>
            <span className={`w-8 h-8 grid place-items-center rounded-lg
              ${k.tone === "mint" ? "bg-mint-100 text-mint-700"
              : k.tone === "warn" ? "bg-amber-100 text-amber-700"
              : "bg-ink-100 text-ink-700"}`}>
              <AdminIcon name={k.icon} className="w-4 h-4"/>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[26px] sm:text-[30px] leading-none font-bold tracking-tight text-ink-900 tabular-nums">{k.value}</span>
            {k.unit && <span className="text-[12px] font-mono text-ink-500">{k.unit}</span>}
          </div>
          {k.sub && <div className="mt-2 text-[11.5px] font-semibold text-amber-600">{k.sub}</div>}
        </div>
      ))}
    </div>

    {/* Booking table — full list (paginated inside BookingsSection), not a recent-8 cap */}
    <BookingsSection bookings={bookings} store={store} set={set}/>

  </div>
);

Object.assign(window, { ServicesSection, NationalitiesSection, PackagesSection, MaterialsSection, BookingsSection, OverviewSection, HourlySection, MonthlySection, StayInSection });


/* Admin app — sidebar shell, routing, seed data (root) */

const NAV = [
  { id: "overview",      label: "Overview",        icon: "grid" },
  { id: "bookings",      label: "Bookings",         icon: "list" },
  { id: "calendar",      label: "Calendar View",    icon: "calendar" },
  { id: "customers",     label: "Customers",        icon: "contact" },
  { id: "staff",         label: "Staff Management", icon: "users" },
  {
    id: "reports-group",
    label: "Reports",
    icon: "trend",
    children: [
      { id: "daily-report", label: "Daily Report", icon: "trend"  },
      { id: "staff-report", label: "Staff Report", icon: "users"  },
    ],
  },
  {
    id: "services-group",
    label: "Services",
    icon: "broom",
    children: [
      { id: "hourly",  label: "Hourly Booking", icon: "broom"   },
      { id: "monthly", label: "Monthly Plans",  icon: "package" },
      { id: "stayin",  label: "Stay-In",        icon: "home"    },
    ],
  },
  { id: "nationalities",    label: "Nationalities",    icon: "globe" },
  { id: "materials",        label: "Materials",        icon: "spray" },
  { id: "settings",         label: "Settings",         icon: "settings" },
];

/* Bookings loaded live from Supabase */

/* KPIs calculated from real bookings */

const initialStore = () => ({
  modes: [
    { id: "hourly",  name: "Hourly Booking", icon: "Clock",    emoji: "⏱️", desc: "On-demand cleaning, billed by the hour.",  bookings: 0, on: false },
    { id: "monthly", name: "Monthly Plans",  icon: "Calendar", emoji: "📅", desc: "Recurring weekly cleaning packages.",       bookings: 0, on: false },
    { id: "stayin",  name: "Stay-In",        icon: "Home",     emoji: "🏠", desc: "Long-term live-in maid contracts.",         bookings: 0, on: false },
  ],
  services: [],
  fixedServices: [],
  limits: {
    minHours: 3,
    maxMaids: 4,
    maxHours: 12,
    leadHours: 1,
    cancelHours: 6,
    radiusKm: 30,
  },
  nationalitiesEnabled: true,
  nationalities: [],
  monthly: [],
  stayIn: [],
  materialsEnabled: false,
  materialsRate: 0,
  availability: {},
  staff: [],
  assignments: {},
  materialsList: [],
  businessHours: { open: 8, close: 19 },
  staffHours: {},   // { [bookingRef]: { [staffId]: hoursFloat } }
});

/* ─── Sidebar ─── */
const SERVICE_CHILD_IDS = ['hourly', 'monthly', 'stayin'];
const REPORT_CHILD_IDS  = ['daily-report', 'staff-report'];

const Sidebar = ({ active, onNav, onClose, mobile, bookingsCount = 0, brand = {} }) => {
  const [openGroups, setOpenGroups] = React.useState(() => ({
    'services-group': SERVICE_CHILD_IDS.includes(active),
    'reports-group':  REPORT_CHILD_IDS.includes(active),
  }));
  const [syncTime, setSyncTime] = React.useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  React.useEffect(() => {
    const t = setInterval(() => setSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 60000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (SERVICE_CHILD_IDS.includes(active)) setOpenGroups(prev => ({ ...prev, 'services-group': true }));
    if (REPORT_CHILD_IDS.includes(active))  setOpenGroups(prev => ({ ...prev, 'reports-group':  true }));
  }, [active]);

  return (
    <aside className={`sidebar-bg flex flex-col text-ink-200 ${mobile ? "h-full w-72" : "w-64 h-screen sticky top-0 overflow-y-auto"}`}>
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Logo: image if set, otherwise sparkle icon */}
          {brand.logo ? (
            <img src={brand.logo} alt="logo" className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 flex-shrink-0"/>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-mint-500 grid place-items-center shadow-mint flex-shrink-0">
              <AdminIcon name="sparkle" className="w-5 h-5 text-ink-900" strokeWidth={2.4}/>
            </div>
          )}
          <div>
            <div className="text-[14.5px] font-extrabold text-white tracking-tight">{brand.name || 'Maid Pro'}</div>
            <div className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-ink-400">MaidPro</div>
          </div>
        </div>
        {mobile && (
          <button onClick={onClose} className="w-9 h-9 rounded-lg grid place-items-center text-ink-300 hover:bg-white/5">
            <AdminIcon name="x" className="w-5 h-5"/>
          </button>
        )}
      </div>

      <nav className="px-3 mt-2 space-y-0.5">
        {NAV.map(n => {
          if (n.children) {
            const groupOpen   = openGroups[n.id] || false;
            const groupActive = n.children.some(c => c.id === active);
            return (
              <div key={n.id}>
                <button
                  onClick={() => setOpenGroups(prev => ({ ...prev, [n.id]: !prev[n.id] }))}
                  className={`relative w-full flex items-center gap-3 h-10 px-3 rounded-lg text-[13.5px] font-medium transition-colors
                    ${groupActive ? "bg-white/10 text-white" : "text-ink-300 hover:bg-white/5 hover:text-white"}`}>
                  <AdminIcon name={n.icon} className="w-4 h-4"/>
                  <span className="flex-1 text-left">{n.label}</span>
                  <AdminIcon name="chevron"
                    className={`w-4 h-4 transition-transform duration-200 ${groupOpen ? "rotate-180" : ""}`}/>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ease-in-out
                  ${groupOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="pl-3 pt-0.5 pb-0.5 space-y-0.5">
                    {n.children.map(c => {
                      const isActive = active === c.id;
                      return (
                        <button key={c.id} onClick={() => { onNav(c.id); onClose && onClose(); }}
                          className={`relative w-full flex items-center gap-3 h-9 pl-5 pr-3 rounded-lg text-[13px] font-medium transition-colors
                            ${isActive ? "bg-white/10 text-white mint-rail" : "text-ink-400 hover:bg-white/5 hover:text-white"}`}>
                          <AdminIcon name={c.icon} className="w-3.5 h-3.5"/>
                          <span>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          const isActive = active === n.id;
          return (
            <button key={n.id} onClick={() => { onNav(n.id); onClose && onClose(); }}
              className={`relative w-full flex items-center gap-3 h-10 px-3 rounded-lg text-[13.5px] font-medium transition-colors
                ${isActive ? "bg-white/10 text-white mint-rail" : "text-ink-300 hover:bg-white/5 hover:text-white"}`}>
              <AdminIcon name={n.icon} className="w-4 h-4"/>
              <span>{n.label}</span>
              {n.id === "bookings" && (
                <span className="ml-auto text-[10.5px] font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-mint-500/20 text-mint-300">{bookingsCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pb-4">
        <div className="rounded-xl p-4 bg-gradient-to-br from-mint-700 to-mint-800 text-white">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-mint-100">
            <span className="w-1.5 h-1.5 rounded-full bg-mint-300 pulse-dot"></span>
            System healthy
          </div>
          <div className="mt-2 text-[13px] font-semibold">All services accepting bookings.</div>
          <div className="mt-1 text-[11.5px] text-mint-100/80">Last synced at {syncTime}.</div>
        </div>

        <div className="mt-3 px-2 py-2 flex items-center gap-3 rounded-lg hover:bg-white/5 cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-mint-500/30 ring-1 ring-mint-400/40 grid place-items-center text-mint-200 font-bold text-[13px]">MP</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-white truncate">Admin</div>
            <div className="text-[11px] text-ink-400 truncate">Operations Lead</div>
          </div>
          <button className="text-ink-400 hover:text-white" aria-label="Sign out"
            onClick={() => supabase.auth.signOut()}>
            <AdminIcon name="logout" className="w-4 h-4"/>
          </button>
        </div>
      </div>
    </aside>
  );
};

/* ─── Mobile bottom nav ─── */
const BottomNav = ({ section, onNav, onMenu }) => {
  const items = [
    { id: 'overview',  label: 'Home',     icon: 'home'     },
    { id: 'bookings',  label: 'Bookings', icon: 'calendar' },
    { id: 'calendar',  label: 'Calendar', icon: 'clock'    },
    { id: 'staff',     label: 'Staff',    icon: 'users'    },
    { id: '__more__',  label: 'More',     icon: 'menu'     },
  ];
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-ink-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex h-14">
        {items.map(item => {
          const isMore   = item.id === '__more__';
          const isActive = !isMore && section === item.id;
          return (
            <button key={item.id}
              onClick={() => isMore ? onMenu() : onNav(item.id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
                ${isActive ? 'text-mint-600' : 'text-ink-400'}`}>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-mint-500"/>
              )}
              <AdminIcon name={item.icon} className="w-5 h-5"/>
              <span className={`text-[10px] font-semibold ${isActive ? 'text-mint-600' : 'text-ink-400'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

/* ─── Top bar ─── */
const TopBar = ({ section, onMenu, store, onClear, searchQuery, onSearch, bookings = [] }) => {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const newBookings = bookings.filter(b => (b.status || b._raw?.status) === 'Pending').slice(0, 8);
  const titles = {
    overview: "Overview",
    bookings: "Bookings",
    services: "Services & Operations",
    hourly: "Hourly Booking",
    monthly: "Monthly Plans",
    stayin: "Stay-In",
    nationalities: "Nationality Manager",
    packages: "Packages",
    materials: "Materials & Add-ons",
    calendar: "Calendar View",
    customers: "Customers",
    staff: "Staff Management",
    settings: "Settings",
    'daily-report': "Daily Report",
    'staff-report': "Staff Report",
  };
  const subtitles = {
    overview: "Snapshot of today's operations.",
    bookings: "Manage every job across hourly, monthly and stay-in.",
    services: "Configure service modes, types and operational limits.",
    hourly: "On-demand cleaning configuration, services and operational limits.",
    monthly: "Recurring monthly subscription plans and renewal rules.",
    stayin: "Long-term live-in maid contracts and inclusions.",
    nationalities: "Edit maid nationality options and rates.",
    packages: "Build monthly plans and stay-in contracts.",
    materials: "Cleaning materials add-on and supplied items.",
    calendar: "Daily staff timeline and monthly capacity.",
    customers: "All customers who have made a booking.",
    staff: "Maids, skills, status and availability.",
    settings: "General configuration.",
    'daily-report': "Revenue, bookings and performance analytics.",
    'staff-report': "Booking count, revenue and workload per staff member.",
  };
  const liveModes = store.modes.filter(m => m.on).length;
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-200/70">
      <div className="px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center gap-2 sm:gap-3">
        <button onClick={onMenu} className="lg:hidden w-10 h-10 -ml-1 grid place-items-center rounded-lg text-ink-700 hover:bg-ink-100 flex-shrink-0">
          <AdminIcon name="menu" className="w-5 h-5"/>
        </button>
        <div className="min-w-0 flex-1">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-500">
            <span>Admin</span><span>/</span>
            <span className="text-ink-700">{titles[section]}</span>
          </div>
          <h1 className="text-[16px] sm:text-[20px] font-extrabold text-ink-900 tracking-tight truncate">{titles[section]}</h1>
        </div>

        <div className="hidden md:flex items-center gap-2 mr-1">
          <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-mint-50 hairline text-mint-800 text-[11.5px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-mint-500 pulse-dot"></span>
            {liveModes}/3 modes live
          </div>
        </div>

        <div className="hidden sm:block w-56 lg:w-64">
          <TextField icon="search" value={searchQuery||''} onChange={v => onSearch && onSearch(v)} placeholder="Search bookings..."/>
        </div>

        {/* Clear-all-bookings button — hidden for now, may be re-enabled later. */}
        {false && (
        <button
          onClick={() => { if (window.confirm('Delete ALL bookings permanently? This cannot be undone.')) onClear(); }}
          className="h-9 w-9 sm:w-auto sm:px-3.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 flex-shrink-0"
        >
          <AdminIcon name="trash" className="w-4 h-4"/>
          <span className="hidden sm:inline">Clear</span>
        </button>
        )}

        <div className="relative">
          <button onClick={() => setNotifOpen(o => !o)} className="relative w-10 h-10 rounded-lg grid place-items-center text-ink-700 hover:bg-ink-100">
            <AdminIcon name="bell" className="w-5 h-5"/>
            {newBookings.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-mint-500 ring-2 ring-white"></span>}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-12 z-50 w-80 bg-white rounded-xl shadow-xl border border-ink-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink-900">New Bookings</span>
                <span className="text-[11px] text-ink-500">{newBookings.length} pending</span>
              </div>
              {newBookings.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px] text-ink-400">No new bookings</div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-ink-100">
                  {newBookings.map(b => (
                    <div key={b.id || b.ref} className="px-4 py-3 hover:bg-ink-50">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-ink-900">{b.ref || b.id}</span>
                        <span className="text-[11px] text-ink-400">{b.date || b._raw?.date || ''}</span>
                      </div>
                      <div className="text-[12px] text-ink-600 truncate">{b.customer || b._raw?.customer_name || 'Unknown'}</div>
                      <div className="text-[11px] text-ink-400">{b.service || b._raw?.service_type || ''} · {b.time || b._raw?.time || ''}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-4 py-2 border-t border-ink-100">
                <button onClick={() => setNotifOpen(false)} className="text-[12px] text-mint-700 hover:text-mint-900 font-medium">Dismiss</button>
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-ink-200">
          <div className="w-9 h-9 rounded-full bg-ink-900 text-white grid place-items-center text-[13px] font-bold">YN</div>
        </div>
      </div>
    </header>
  );
};

/* ─────── Capacity & Calendar ─────── */
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};

const monthShortToIdx = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
const bookingDateKey = (b) => {
  // Prefer the raw ISO date (YYYY-MM-DD) from Supabase — always accurate
  if (b._raw?.date && /^\d{4}-\d{2}-\d{2}$/.test(b._raw.date)) return b._raw.date;
  // Fall back: parse the formatted string ("May 11") using the current year
  const parts = (b.date || "").split(" ");
  if (parts.length < 2) return null;
  const m = monthShortToIdx[parts[0]];
  if (m == null) return null;
  const day = parseInt(parts[1], 10);
  if (isNaN(day)) return null;
  return `${new Date().getFullYear()}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
};

const CalendarSection = ({ store, set, bookings }) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const [view, setView] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = React.useState(ymd(today));
  React.useEffect(() => {
    db('availability').select('*').then(({ data }) => {
      if (!data||!data.length) return
      const avail = {}
      data.forEach(r => { avail[r.date] = { blocked: r.blocked, morning: r.morning, afternoon: r.afternoon } })
      set({ availability: { ...store.availability, ...avail } })
    })
  }, [])

  const monthStart = new Date(view.getFullYear(), view.getMonth(), 1);
  const monthEnd   = new Date(view.getFullYear(), view.getMonth()+1, 0);
  // Build a Mon-start grid
  const startWeekday = (monthStart.getDay() + 6) % 7; // 0=Mon
  const totalCells = Math.ceil((startWeekday + monthEnd.getDate()) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startWeekday + 1;
    if (dayNum >= 1 && dayNum <= monthEnd.getDate()) {
      cells.push(new Date(view.getFullYear(), view.getMonth(), dayNum));
    } else {
      cells.push(null);
    }
  }

  const filteredBookings = bookings;

  const bookingsByDate = React.useMemo(() => {
    const m = {};
    for (const b of filteredBookings) {
      const k = bookingDateKey(b);
      if (!k) continue;
      (m[k] = m[k] || []).push(b);
    }
    return m;
  }, [filteredBookings]);

  const getEntry = (key) => store.availability[key] || { blocked: false, morning: true, afternoon: true };

  const toggleBlock = (key) => {
    const cur = getEntry(key);
    const next = !cur.blocked;
    const row = { blocked: next, morning: !next, afternoon: !next };
    // Functional updater avoids stale-closure race with Supabase realtime
    set(prev => ({ availability: { ...(prev.availability || {}), [key]: row } }));
    db('availability').upsert({ date: key, ...row }, { onConflict: 'company_id,date' })
      .then(({ error }) => {
        if (error) console.warn('availability upsert:', error.message);
        else broadcastSettingsUpdate();
      });
  };

  const toggleSlot = (key, slot) => {
    const cur = getEntry(key);
    const row = { ...cur, [slot]: !cur[slot] };
    row.blocked = !(row.morning || row.afternoon);
    set(prev => ({ availability: { ...(prev.availability || {}), [key]: row } }));
    db('availability').upsert({ date: key, ...row }, { onConflict: 'company_id,date' })
      .then(({ error }) => {
        if (error) console.warn('availability upsert:', error.message);
        else broadcastSettingsUpdate();
      });
  };

  const blockedCount = Object.values(store.availability).filter(a => a.blocked).length;
  const partialCount = Object.values(store.availability).filter(a => !a.blocked && (!a.morning || !a.afternoon)).length;

  const selectedDate = selectedKey ? new Date(selectedKey + "T00:00:00") : null;
  const selectedEntry = selectedKey ? getEntry(selectedKey) : null;
  const selectedBookings = (selectedKey && bookingsByDate[selectedKey]) || [];

  const navMonth = (delta) => setView(new Date(view.getFullYear(), view.getMonth()+delta, 1));

  return (
    <div className="space-y-5 fade-up">
      {/* Day navigator */}
      <div className="bg-white rounded-xl hairline p-4">
        <div className="flex items-center gap-2">

          {/* Prev day */}
          <button
            onClick={() => {
              const d = new Date(selectedKey + 'T00:00:00'); d.setDate(d.getDate() - 1);
              setSelectedKey(ymd(d)); setView(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            className="w-9 h-9 rounded-lg hover:bg-ink-100 grid place-items-center text-ink-700 flex-shrink-0">
            <AdminIcon name="arrow-left" className="w-4 h-4"/>
          </button>

          {/* Date picker — visible styled input */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-ink-50 hairline w-full">
              <AdminIcon name="calendar" className="w-4 h-4 text-mint-600 flex-shrink-0"/>
              <input
                type="date"
                value={selectedKey}
                onChange={e => {
                  if (!e.target.value) return;
                  const d = new Date(e.target.value + 'T00:00:00');
                  setSelectedKey(e.target.value);
                  setView(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
                className="flex-1 bg-transparent text-[13.5px] font-bold text-ink-900 outline-none cursor-pointer min-w-0"
              />
            </div>
            <div className="text-[11.5px] text-ink-500 text-center">
              {selectedDate
                ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
                : ''}
              {selectedBookings.length > 0
                ? ` · ${selectedBookings.length} booking${selectedBookings.length !== 1 ? 's' : ''}`
                : selectedDate ? ' · No bookings' : ''}
            </div>
          </div>

          {/* Next day */}
          <button
            onClick={() => {
              const d = new Date(selectedKey + 'T00:00:00'); d.setDate(d.getDate() + 1);
              setSelectedKey(ymd(d)); setView(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            className="w-9 h-9 rounded-lg hover:bg-ink-100 grid place-items-center text-ink-700 flex-shrink-0">
            <AdminIcon name="arrow-right" className="w-4 h-4"/>
          </button>

          {/* Today */}
          <button
            onClick={() => { setSelectedKey(ymd(today)); setView(new Date(today.getFullYear(), today.getMonth(), 1)); }}
            className="h-8 px-3 rounded-full text-[12px] font-semibold bg-mint-100 hover:bg-mint-200 text-mint-800 flex-shrink-0">
            Today
          </button>

        </div>
      </div>

      <StaffSchedule store={store} bookings={filteredBookings} dateKey={selectedKey}/>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Days blocked",   value: blockedCount,             icon: "x",        tone: "red" },
          { label: "Partial days",   value: partialCount,             icon: "sliders",  tone: "ink" },
          { label: "Bookings (mo.)", value: filteredBookings.length,  icon: "calendar", tone: "mint" },
          { label: "Capacity used",  value: "68",  unit: "%",         icon: "trend",    tone: "mint" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl2 hairline shadow-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">{k.label}</span>
              <span className={`w-8 h-8 grid place-items-center rounded-lg ${k.tone === "mint" ? "bg-mint-100 text-mint-700" : k.tone === "red" ? "bg-red-50 text-red-600" : "bg-ink-100 text-ink-700"}`}>
                <AdminIcon name={k.icon} className="w-4 h-4"/>
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-[26px] sm:text-[30px] leading-none font-bold tracking-tight text-ink-900 tabular-nums">{k.value}</span>
              {k.unit && <span className="text-[12px] font-mono text-ink-500">{k.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 sm:gap-5">
        {/* Calendar */}
        <Card padded={false}>
          <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-3 flex items-center gap-2 border-b border-ink-200/70">
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] sm:text-[15px] font-bold text-ink-900 tracking-tight">{MONTHS_FULL[view.getMonth()]} {view.getFullYear()}</h3>
              <p className="mt-0.5 text-[11.5px] text-ink-500 hidden sm:block">Tap a date to inspect or block.</p>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <IconBtn icon="arrow-left" onClick={() => navMonth(-1)} title="Previous month"/>
              <button onClick={() => { setView(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedKey(ymd(today)); }}
                className="h-8 sm:h-9 px-2 sm:px-3 rounded-lg text-[12px] sm:text-[12.5px] font-semibold text-ink-700 hover:bg-ink-100">Today</button>
              <IconBtn icon="arrow-right" onClick={() => navMonth(1)} title="Next month"/>
            </div>
          </div>

          {/* Legend */}
          <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-ink-200/70 flex flex-wrap items-center gap-x-3 sm:gap-x-5 gap-y-1.5 text-[10.5px] sm:text-[11.5px] text-ink-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-md bg-mint-100 ring-1 ring-mint-300"></span>Available</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-md bg-amber-100 ring-1 ring-amber-300"></span>Partial</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-md bg-red-50 ring-1 ring-red-300"></span>Blocked</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-mint-600"></span>Bookings</span>
          </div>

          {/* Weekday header */}
          <div className="px-3 sm:px-6 pt-2.5 sm:pt-3 grid grid-cols-7 gap-1 sm:gap-1.5 text-center font-bold uppercase text-ink-500"
               style={{ fontSize: 'clamp(9px, 2.2vw, 10.5px)', letterSpacing: '0.08em' }}>
            {WEEKDAYS_SHORT.map(d => (
              <div key={d} className="py-0.5 sm:py-1">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>

          {/* Date grid */}
          <div className="px-3 sm:px-6 pb-4 sm:pb-5 pt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="aspect-square sm:h-20"/>;
              const k = ymd(d);
              const entry = getEntry(k);
              const isToday = d.getTime() === today.getTime();
              const isPast = d < today;
              const sel = selectedKey === k;
              const todays = bookingsByDate[k] || [];
              const partial = !entry.blocked && (!entry.morning || !entry.afternoon);

              let cls = "bg-mint-50 hover:bg-mint-100 ring-1 ring-mint-200 text-ink-900";
              if (entry.blocked) cls = "bg-red-50 hover:bg-red-100 ring-1 ring-red-300 text-red-800";
              else if (partial)  cls = "bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300 text-ink-900";
              if (isPast && !entry.blocked) cls = "bg-ink-50 ring-1 ring-ink-200 text-ink-400 hover:bg-ink-100";
              if (sel) cls += " ring-2 ring-mint-600 shadow-mint";

              return (
                <button
                  key={k}
                  onClick={() => setSelectedKey(k)}
                  onDoubleClick={() => toggleBlock(k)}
                  className={`relative rounded-md sm:rounded-lg aspect-square sm:aspect-auto sm:h-20 p-1 sm:p-2 text-left transition-all ${cls}`}
                  aria-label={`${d.toDateString()} — ${entry.blocked ? "blocked" : partial ? "partial availability" : "available"}`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`font-bold tabular-nums leading-none ${isToday ? "px-1 sm:px-1.5 rounded-full bg-ink-900 text-white" : ""}`}
                          style={{ fontSize: 'clamp(10px, 2.8vw, 13px)' }}>
                      {d.getDate()}
                    </span>
                    {todays.length > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold tabular-nums text-mint-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-mint-600"></span>{todays.length}
                      </span>
                    )}
                  </div>
                  {/* Slot strip — desktop */}
                  <div className="hidden sm:flex absolute bottom-1.5 left-1.5 right-1.5 gap-1">
                    <span className={`flex-1 h-1.5 rounded-full ${entry.blocked || !entry.morning ? "bg-ink-200" : "bg-mint-500"}`}></span>
                    <span className={`flex-1 h-1.5 rounded-full ${entry.blocked || !entry.afternoon ? "bg-ink-200" : "bg-mint-600"}`}></span>
                  </div>
                  {/* Slot dots — mobile */}
                  <div className="sm:hidden absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5">
                    {todays.length > 0 && <span className="w-1 h-1 rounded-full bg-mint-600"></span>}
                    {partial && !entry.blocked && <span className="w-1 h-1 rounded-full bg-amber-400"></span>}
                  </div>
                  {entry.blocked && (
                    <span className="absolute top-0.5 right-0.5 sm:top-1.5 sm:right-1.5 text-red-500">
                      <AdminIcon name="x" className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.4}/>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Selected day panel */}
        <Card padded={false} className="self-start">
          <div className="px-5 pt-5 pb-3 border-b border-ink-200/70">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">Selected date</div>
            <div className="mt-1 flex items-baseline justify-between gap-2 flex-wrap">
              <h3 className="text-[18px] font-extrabold text-ink-900 tracking-tight">
                {selectedDate ? selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "—"}
              </h3>
              {selectedEntry && (
                selectedEntry.blocked
                  ? <Pill tone="red"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>Blocked</Pill>
                  : (!selectedEntry.morning || !selectedEntry.afternoon)
                    ? <Pill tone="yellow"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Partial</Pill>
                    : <Pill tone="mint"><span className="w-1.5 h-1.5 rounded-full bg-mint-500"></span>Available</Pill>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Block whole day */}
            <button
              onClick={() => toggleBlock(selectedKey)}
              className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors
                ${selectedEntry?.blocked
                  ? "bg-red-50 hairline text-red-800 hover:bg-red-100"
                  : "bg-mint-50 hairline text-mint-800 hover:bg-mint-100"}`}
            >
              <div className="text-left">
                <div className="text-[13.5px] font-bold">{selectedEntry?.blocked ? "Unblock this date" : "Block entire day"}</div>
                <div className="text-[11.5px] opacity-80">{selectedEntry?.blocked ? "Re-open both slots." : "Mark as blackout — no new jobs."}</div>
              </div>
              <AdminIcon name={selectedEntry?.blocked ? "check" : "x"} className="w-5 h-5" strokeWidth={2.2}/>
            </button>

            {/* Slot toggles */}
            <div>
              <Label>Slots</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { key: "morning",   label: "Morning",   sub: "08:00 — 12:00" },
                  { key: "afternoon", label: "Afternoon", sub: "13:00 — 18:00" },
                ].map(s => {
                  const on = !!selectedEntry?.[s.key] && !selectedEntry?.blocked;
                  return (
                    <button key={s.key}
                      onClick={() => !selectedEntry?.blocked && toggleSlot(selectedKey, s.key)}
                      disabled={selectedEntry?.blocked}
                      className={`relative rounded-xl p-3 text-left transition-all
                        ${on
                          ? "bg-mint-50 ring-2 ring-mint-500"
                          : "bg-ink-50 hairline text-ink-600 hover:bg-ink-100"}
                        ${selectedEntry?.blocked ? "opacity-50 cursor-not-allowed" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[13.5px] font-bold text-ink-900">{s.label}</span>
                        <span className={`w-4 h-4 rounded-full grid place-items-center ${on ? "bg-mint-500 text-ink-900" : "bg-ink-200 text-ink-500"}`}>
                          {on && <AdminIcon name="check" className="w-3 h-3" strokeWidth={3}/>}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11.5px] font-mono text-ink-500">{s.sub}</div>
                      <div className={`mt-2 text-[10.5px] font-mono uppercase tracking-[0.14em] ${on ? "text-mint-700" : "text-ink-500"}`}>
                        {on ? "â— Open" : "â—‹ Closed"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bookings on this day */}
            <div>
              <div className="flex items-baseline justify-between">
                <Label>Bookings</Label>
                <span className="text-[11.5px] font-mono text-ink-500 tabular-nums">{selectedBookings.length} job{selectedBookings.length !== 1 ? "s" : ""}</span>
              </div>
              {selectedBookings.length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center">
                  <div className="text-[12.5px] text-ink-500">No bookings on this date.</div>
                </div>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {selectedBookings.map(b => (
                    <li key={b.ref} className="rounded-lg hairline bg-white p-2.5 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-mint-100 text-mint-800 grid place-items-center text-[11.5px] font-bold flex-shrink-0">
                        {b.customer.split(" ").map(s => s[0]).slice(0,2).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold text-ink-900 truncate">{b.customer}</div>
                        <div className="text-[11px] text-ink-500 truncate">{b.service} · {b.time} · {b.maids}×{b.hours}h</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10.5px] font-mono text-ink-500">{b.ref}</div>
                        <StatusPill status={b.status}/>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Daily staff schedule for selected date */}
    </div>
  );
};

/* ─────── Staff Management ─────── */
const STAFF_COLORS = {
  mint:   { bg: "bg-mint-100",   text: "text-mint-800",   block: "bg-mint-50 ring-mint-300 text-mint-900" },
  sky:    { bg: "bg-sky-100",    text: "text-sky-800",    block: "bg-sky-50 ring-sky-300 text-sky-900" },
  pink:   { bg: "bg-pink-100",   text: "text-pink-800",   block: "bg-pink-50 ring-pink-300 text-pink-900" },
  amber:  { bg: "bg-amber-100",  text: "text-amber-800",  block: "bg-amber-50 ring-amber-300 text-amber-900" },
  violet: { bg: "bg-violet-100", text: "text-violet-800", block: "bg-violet-50 ring-violet-300 text-violet-900" },
};
const initials = (name) => name.split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();

const StaffAvatar = ({ s, size = 40 }) => {
  const c = STAFF_COLORS[s.color] || STAFF_COLORS.mint;
  return (
    <div className={`rounded-full grid place-items-center font-bold ${c.bg} ${c.text} ring-2 ring-white shadow-card`}
         style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(s.name)}
    </div>
  );
};

/* ─── Customer Management ─── */
const TAG_META = {
  vip:      { label: "VIP",      bg: "bg-amber-100",  text: "text-amber-800"  },
  loyal:    { label: "Loyal",    bg: "bg-mint-100",   text: "text-mint-800"   },
  new:      { label: "New",      bg: "bg-sky-100",    text: "text-sky-800"    },
  regular:  { label: "Regular",  bg: "bg-ink-100",    text: "text-ink-700"    },
  inactive: { label: "Inactive", bg: "bg-red-100",    text: "text-red-700"    },
};
const TAGS = Object.keys(TAG_META);

/* ─────── Regulars View ─────── */
const RegularsView = () => {
  const [schedules,  setSchedules]  = React.useState([]);
  const [staffList,  setStaffList]  = React.useState([]);
  const [loading,    setLoading]    = React.useState(true);
  const [tableError, setTableError] = React.useState('');
  const [draft,      setDraft]      = React.useState(null);
  const [saving,     setSaving]     = React.useState(false);
  const [draftErr,   setDraftErr]   = React.useState('');
  const [generating, setGenerating] = React.useState(null);
  const [genResult,  setGenResult]  = React.useState({});

  const DAYS_OW   = [{ v:0,l:'Sun' },{ v:1,l:'Mon' },{ v:2,l:'Tue' },{ v:3,l:'Wed' },{ v:4,l:'Thu' },{ v:5,l:'Fri' },{ v:6,l:'Sat' }];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const TIME_OPTS = Array.from({ length: 14 }, (_, i) => {
    const h = i + 7; const ap = h < 12 ? 'AM' : 'PM'; const h12 = h % 12 || 12;
    return `${h12}:00 ${ap}`;
  });
  const SERVICES_LIST = ['Regular Cleaning','Deep Cleaning','Move-in / Out','Post-Construction'];
  const ordSfx = (d) => d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th';

  const fetchAll = React.useCallback(async () => {
    setLoading(true);
    const [{ data: scheds, error: schErr }, { data: staff }] = await Promise.all([
      db('regular_schedules').select('*').order('created_at', { ascending: false }),
      db('staff').select('id, name, color, working_days'),
    ]);
    if (schErr) {
      setTableError(
        schErr.code === '42P01' || schErr.message?.includes('does not exist')
          ? 'Run supabase-features.sql in Supabase SQL Editor to enable this feature.'
          : schErr.message
      );
    } else {
      setSchedules(scheds || []);
      setTableError('');
    }
    setStaffList(staff || []);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Build candidate date slots (weekly or monthly) ────────────────────────
  const buildSlots = React.useCallback((schedule) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const type = schedule.schedule_type || 'weekly';
    const slots = [];

    if (type === 'weekly') {
      for (let w = 0; w < 4; w++) {
        for (const dow of (schedule.days_of_week || [])) {
          const d = new Date(today);
          let diff = (dow - d.getDay() + 7) % 7;
          if (diff === 0 && w === 0) diff = 7;
          d.setDate(d.getDate() + diff + w * 7);
          if (d > today) slots.push(ymd(d));
        }
      }
    } else {
      // Monthly: generate for the current month + next month
      for (let m = 0; m < 2; m++) {
        const targetYear  = today.getFullYear() + Math.floor((today.getMonth() + m) / 12);
        const targetMonth = (today.getMonth() + m) % 12;
        for (const dom of (schedule.monthly_dates || [])) {
          const d = new Date(targetYear, targetMonth, dom);
          // Skip if JS rolled the date into a different month (e.g. Feb 31)
          if (d.getMonth() !== targetMonth) continue;
          if (d > today) slots.push(ymd(d));
        }
      }
    }

    return [...new Set(slots)].sort().filter(Boolean);
  }, []);

  const generateBookings = React.useCallback(async (schedule) => {
    setGenerating(schedule.id);
    const allSlots = buildSlots(schedule);

    if (!allSlots.length) {
      setGenResult(r => ({ ...r, [schedule.id]: { count: 0, msg: 'No upcoming slots found.' } }));
      setGenerating(null); return;
    }

    // Skip dates that already have a booking for this customer — INCLUDING
    // cancelled ones. A cancelled slot must NOT be regenerated, otherwise
    // cancelling a recurring booking would silently recreate it as a fresh
    // active booking (which then reappears in revenue/outstanding totals).
    const { data: existing } = await db('bookings')
      .select('date').eq('phone', schedule.customer_phone)
      .in('date', allSlots);
    const existingDates = new Set((existing || []).map(b => b.date));
    const newSlots = allSlots.filter(d => !existingDates.has(d));

    if (!newSlots.length) {
      setGenResult(r => ({ ...r, [schedule.id]: { count: 0, msg: 'All slots already have bookings.' } }));
      setGenerating(null); return;
    }

    // Resolve staff: prefer saved preference, otherwise auto-pick by working_days
    let staffToUse = (schedule.assigned_staff || []).filter(Boolean);
    if (!staffToUse.length) {
      let staffPick = await db('staff').select('id, skills, working_days, active');
      let avail = staffPick.data;
      if (staffPick.error || !avail) {
        const fb = await db('staff').select('id, skills');
        avail = (fb.data || []).map(s => ({ ...s, working_days: null, active: true }));
      }
      const scheduleDate = schedule.date || new Date().toISOString().split('T')[0];
      if (avail?.length) {
        staffToUse = avail
          .filter(s => s.active !== false)              // skip on-hold staff
          .filter(s => isWorkingDay(s, scheduleDate))   // skip staff whose day off falls on this date
          .filter(s => { const sk = Array.isArray(s.skills) ? s.skills : []; return !sk.some(x => x.startsWith('@')) || sk.some(x => x === '@hourly'); })
          .slice(0, Math.max(1, Number(schedule.maids) || 1)).map(s => s.id);
      }
    }

    // Sequential booking refs — derive from the highest existing ref, not count,
    // so deletions or concurrent inserts can't produce a duplicate key collision.
    const { data: lastRow } = await supabase
      .from('bookings').select('ref').order('id', { ascending: false }).limit(1);
    let refBase = 0;
    if (lastRow?.[0]?.ref) {
      const m = String(lastRow[0].ref).match(/^MP-(\d+)$/);
      if (m) refBase = parseInt(m[1], 10);
    }
    const type    = schedule.schedule_type || 'weekly';
    const label   = type === 'weekly'
      ? (schedule.days_of_week || []).map(d => DAY_NAMES[d]).join(', ')
      : (schedule.monthly_dates || []).map(d => `${d}${ordSfx(d)}`).join(', ');

    // Double-booking guard for recurring slots: pull every booking that already
    // exists on the dates we're about to generate, grouped by date, so each new
    // slot only keeps the preferred maids who are actually free that day.
    const startTime = schedule.start_time || '9:00 AM';
    const slotHours = Number(schedule.hours) || 4;
    const { data: slotBks } = await db('bookings')
      .select('id, ref, time, hours, assigned_staff, status, date')
      .in('date', newSlots);
    const bksByDate = {};
    (slotBks || []).forEach(b => { (bksByDate[b.date] = bksByDate[b.date] || []).push(b); });

    const rows = newSlots.map((dateStr, i) => ({
      ref:            `MP-${String(refBase + i + 1).padStart(3, '0')}`,
      name:           schedule.customer_name,
      phone:          schedule.customer_phone,
      service:        schedule.service || 'Regular Cleaning',
      mode:           'hourly',
      date:           dateStr,
      time:           startTime,
      hours:          slotHours,
      cleaners:       Number(schedule.maids) || 1,
      rate:           0,
      total:          0,
      status:         'Pending',
      // Keep only preferred maids who are free on this specific date — never
      // double-book an overlapping slot.
      assigned_staff: filterFreeMaids(staffToUse, bksByDate[dateStr] || [], startTime, slotHours),
      // Embed schedule ID so syncFutureBookings can find these bookings precisely
      notes:          `[sch:${schedule.id}] Recurring: ${label}`,
    }));

    const { error } = await db('bookings').insert(rows);
    setGenResult(r => ({ ...r, [schedule.id]: error
      ? { count: -1, msg: error.message }
      : { count: rows.length, msg: `Generated ${rows.length} booking${rows.length !== 1 ? 's' : ''}.` },
    }));
    setGenerating(null);
  }, [buildSlots]);

  // ── Auto-cleanup / desync on update ───────────────────────────────────────
  // Two-pass matching covers both new bookings (tagged [sch:ID]) and legacy
  // bookings (generated before the tag was introduced — identified by phone +
  // any "Recurring" keyword in notes that lacks a different [sch:] anchor).
  const syncFutureBookings = React.useCallback(async (oldSch, newSch) => {
    const today    = new Date(); today.setHours(0,0,0,0);
    const todayStr = ymd(today);
    const sid      = newSch.id;

    // Fetch ALL future non-cancelled bookings for this customer in one round-trip
    const { data: allBks } = await db('bookings')
      .select('id, date, time, hours, cleaners, notes')
      .eq('phone', newSch.customer_phone)
      .gt('date', todayStr)
      .neq('status', 'Cancelled');

    // Identify which bookings belong to THIS schedule:
    //   • Precise: note starts with the schedule's own [sch:ID] tag
    //   • Legacy:  note contains "Recurring" (any case) but has NO [sch:] tag
    //             (i.e. generated before the ID-embedding was introduced)
    const futureBks = (allBks || []).filter(b => {
      const n = b.notes || '';
      if (n.startsWith(`[sch:${sid}]`)) return true;               // precise
      if (/recurring/i.test(n) && !/^\[sch:/.test(n)) return true; // legacy fallback
      return false;
    });

    if (!futureBks.length) return { deleted: 0, updated: 0 };

    const type        = newSch.schedule_type || 'weekly';
    const activeDays  = type === 'weekly'  ? (newSch.days_of_week  || []) : [];
    const activeDates = type === 'monthly' ? (newSch.monthly_dates || []) : [];

    const toDelete = [];
    const toUpdate = [];

    for (const b of futureBks) {
      const bDate  = new Date(b.date + 'T00:00:00');
      const isActive = type === 'weekly'
        ? activeDays.includes(bDate.getDay())
        : activeDates.includes(bDate.getDate());

      if (!isActive) {
        toDelete.push(b.id);
      } else {
        const changed = b.time     !== newSch.start_time
          || Number(b.hours)    !== Number(newSch.hours)
          || Number(b.cleaners) !== Number(newSch.maids);
        if (changed) toUpdate.push(b.id);
      }
    }

    const ops = [];
    if (toDelete.length)
      ops.push(db('bookings').delete().in('id', toDelete));
    if (toUpdate.length)
      ops.push(db('bookings').update({
        time:           newSch.start_time || '9:00 AM',
        hours:          Number(newSch.hours) || 4,
        cleaners:       Number(newSch.maids) || 1,
        assigned_staff: newSch.assigned_staff || [],
      }).in('id', toUpdate));
    if (ops.length) await Promise.all(ops);

    return { deleted: toDelete.length, updated: toUpdate.length };
  }, []);

  const saveDraft = async () => {
    if (!draft.customer_name?.trim()) { setDraftErr('Customer name is required.'); return; }
    if (!draft.customer_phone?.trim()) { setDraftErr('Phone is required.'); return; }
    const isWeekly = (draft.schedule_type || 'weekly') === 'weekly';
    if (isWeekly  && !(draft.days_of_week  || []).length) { setDraftErr('Select at least one day of the week.'); return; }
    if (!isWeekly && !(draft.monthly_dates || []).length) { setDraftErr('Select at least one date of the month.'); return; }

    setDraftErr(''); setSaving(true);
    const isNew = !draft.id;
    const row = {
      id:             draft.id || 'reg_' + Date.now(),
      customer_name:  draft.customer_name.trim(),
      customer_phone: draft.customer_phone.trim(),
      service:        draft.service        || 'Regular Cleaning',
      nationality:    draft.nationality    || '',
      schedule_type:  draft.schedule_type  || 'weekly',
      days_of_week:   draft.days_of_week   || [],
      monthly_dates:  draft.monthly_dates  || [],
      start_time:     draft.start_time     || '9:00 AM',
      hours:          Number(draft.hours)  || 4,
      maids:          Number(draft.maids)  || 1,
      assigned_staff: draft.assigned_staff || [],
      active:         draft.active !== false,
      notes:          draft.notes  || '',
    };

    const oldSch = isNew ? null : schedules.find(s => s.id === draft.id);

    const { error } = isNew
      ? await db('regular_schedules').insert(row)
      : await db('regular_schedules').update(row).eq('id', draft.id);
    setSaving(false);
    if (error) { setDraftErr(error.message); return; }

    setDraft(null);
    await fetchAll();

    // On update: remove/update future bookings that no longer match the new schedule
    if (!isNew && oldSch) {
      const sync = await syncFutureBookings(oldSch, row);
      if (sync.deleted > 0 || sync.updated > 0) {
        setGenResult(r => ({ ...r, [row.id]: {
          count: 0,
          msg: [
            sync.deleted > 0 ? `${sync.deleted} booking${sync.deleted !== 1 ? 's' : ''} removed` : '',
            sync.updated > 0 ? `${sync.updated} updated` : '',
          ].filter(Boolean).join(', ') + ' · ',
        }}));
      }
    }

    // Generate new slots (skips dates that already have a booking)
    generateBookings(row);
  };

  const deleteSchedule = async (id) => {
    if (!window.confirm('Delete this schedule? Existing generated bookings are kept.')) return;
    await db('regular_schedules').delete().eq('id', id);
    setSchedules(s => s.filter(x => x.id !== id));
  };

  const toggleActive = async (id, active) => {
    setSchedules(s => s.map(x => x.id === id ? { ...x, active } : x));
    await db('regular_schedules').update({ active }).eq('id', id);
  };

  const iniT = (name) => (name || '?').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  const DAY_COLORS = ['bg-ink-100 text-ink-700','bg-mint-100 text-mint-800','bg-sky-100 text-sky-800','bg-violet-100 text-violet-800','bg-amber-100 text-amber-800','bg-pink-100 text-pink-800','bg-ink-200 text-ink-600'];

  return (
    <div className="space-y-4">
      {tableError && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-[13px] text-amber-800">
          <strong>Setup required:</strong> {tableError}
        </div>
      )}

      <Card
        title={`Regular Schedules · ${schedules.filter(s => s.active).length} active`}
        subtitle="Weekly or monthly recurring routines — auto-generates confirmed bookings on save."
        action={
          <PrimaryBtn size="sm" onClick={() => setDraft({ id:null, customer_name:'', customer_phone:'', service:'Regular Cleaning', nationality:'', schedule_type:'weekly', days_of_week:[], monthly_dates:[], start_time:'9:00 AM', hours:4, maids:1, assigned_staff:[], active:true, notes:'' })}>
            <AdminIcon name="plus" className="w-4 h-4"/>New Schedule
          </PrimaryBtn>
        }
        padded={false}
      >
        {loading ? (
          <div className="px-6 py-10 text-center text-[13px] text-ink-400">Loading…</div>
        ) : schedules.length === 0 && !tableError ? (
          <div className="px-6 py-12 text-center">
            <div className="text-[32px] mb-2">🔄</div>
            <div className="text-[14px] font-semibold text-ink-700 mb-1">No recurring schedules yet</div>
            <div className="text-[12.5px] text-ink-400">Add a schedule to auto-generate weekly confirmed bookings.</div>
          </div>
        ) : (
          <ul>
            {schedules.map((sch, i) => {
              const res          = genResult[sch.id];
              const aStaff       = (sch.assigned_staff || []).map(id => staffList.find(s => s.id === id)).filter(Boolean);
              return (
                <li key={sch.id} className={`px-5 py-4 ${i ? 'border-t border-ink-200/70' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-mint-100 text-mint-800 flex items-center justify-center text-[12px] font-bold flex-shrink-0 mt-0.5">
                      {iniT(sch.customer_name)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[14px] text-ink-900">{sch.customer_name}</span>
                        <span className="text-[12px] font-mono text-ink-500">{sch.customer_phone}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${sch.active ? 'bg-mint-100 text-mint-800' : 'bg-ink-100 text-ink-500'}`}>
                          {sch.active ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(sch.schedule_type || 'weekly') === 'monthly' ? (
                          <>
                            <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-violet-50 text-violet-700 ring-1 ring-violet-200">Monthly</span>
                            {(sch.monthly_dates || []).sort((a,b) => a-b).map(d => (
                              <span key={d} className="px-2 py-0.5 rounded-lg text-[11.5px] font-bold bg-violet-100 text-violet-800">{d}{ordSfx(d)}</span>
                            ))}
                          </>
                        ) : (
                          (sch.days_of_week || []).sort((a,b) => a-b).map(d => (
                            <span key={d} className={`px-2 py-0.5 rounded-lg text-[11.5px] font-bold ${DAY_COLORS[d % DAY_COLORS.length]}`}>{DAY_NAMES[d]}</span>
                          ))
                        )}
                        <span className="text-[12px] text-ink-600 font-mono ml-1">{sch.start_time} · {sch.hours}h · {sch.maids} maid{sch.maids > 1 ? 's' : ''}</span>
                        <span className="text-[12px] text-ink-500">{sch.service}</span>
                      </div>
                      {aStaff.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-ink-400">Staff:</span>
                          {aStaff.map(s => { const c = STAFF_COLORS[s.color] || STAFF_COLORS.mint; return (
                            <div key={s.id} className={`w-6 h-6 rounded-full grid place-items-center text-[9px] font-bold ring-1 ring-white ${c.bg} ${c.text}`}>{iniT(s.name)}</div>
                          );})}
                        </div>
                      )}
                      {res && (
                        <div className={`text-[11.5px] font-medium flex items-center gap-1 ${res.count > 0 ? 'text-mint-700' : res.count < 0 ? 'text-red-600' : 'text-ink-500'}`}>
                          {res.count > 0 && <AdminIcon name="check" className="w-3.5 h-3.5"/>}{res.msg}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Switch on={sch.active} onChange={v => toggleActive(sch.id, v)} ariaLabel="Toggle active"/>
                      <button onClick={() => generateBookings(sch)} disabled={generating === sch.id}
                        title="Generate upcoming bookings"
                        className="w-8 h-8 rounded-lg grid place-items-center text-mint-700 hover:bg-mint-50 transition-colors disabled:opacity-40">
                        {generating === sch.id
                          ? <span className="w-3.5 h-3.5 rounded-full border-2 border-mint-300 border-t-mint-600 animate-spin block"/>
                          : <AdminIcon name="sparkle" className="w-4 h-4"/>}
                      </button>
                      <IconBtn icon="edit"  onClick={() => { setDraftErr(''); setDraft({ schedule_type:'weekly', monthly_dates:[], ...sch }); }}/>
                      <IconBtn icon="trash" tone="danger" onClick={() => deleteSchedule(sch.id)}/>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {draft !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setDraft(null)}/>
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl ring-1 ring-ink-200 p-5 sm:p-6 space-y-4 fade-up overflow-y-auto max-h-[90vh]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-mint-500 grid place-items-center text-ink-900 flex-shrink-0">
                <AdminIcon name="calendar" className="w-5 h-5"/>
              </div>
              <div className="flex-1">
                <h3 className="text-[16px] font-bold text-ink-900">{draft.id ? 'Edit Schedule' : 'New Regular Schedule'}</h3>
                <p className="text-[12.5px] text-ink-500 mt-0.5">
                  {(draft.schedule_type || 'weekly') === 'weekly'
                    ? 'Weekly recurring routine — bookings auto-generated on save.'
                    : 'Monthly date routine — bookings auto-generated on save.'}
                </p>
              </div>
              <button onClick={() => setDraft(null)} className="w-8 h-8 rounded-lg hover:bg-ink-100 grid place-items-center text-ink-500">
                <AdminIcon name="x" className="w-4 h-4"/>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1">Customer Name *</label>
                <input value={draft.customer_name} onChange={e => setDraft(d => ({ ...d, customer_name: e.target.value }))}
                  placeholder="e.g. Sarah Al Rashid"
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1">Phone *</label>
                <input value={draft.customer_phone} onChange={e => setDraft(d => ({ ...d, customer_phone: e.target.value }))}
                  placeholder="+974 5555 1234"
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1">Service</label>
                <select value={draft.service} onChange={e => setDraft(d => ({ ...d, service: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none">
                  {SERVICES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1">Preferred Nationality</label>
                <input value={draft.nationality} onChange={e => setDraft(d => ({ ...d, nationality: e.target.value }))}
                  placeholder="Philippines (optional)"
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none"/>
              </div>
            </div>

            {/* ── Schedule Type toggle ── */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-2">Schedule Type</label>
              <div className="flex gap-1 bg-ink-100 rounded-xl p-1">
                {[['weekly','Weekly Days'],['monthly','Monthly Dates']].map(([val, label]) => (
                  <button key={val} type="button"
                    onClick={() => setDraft(d => ({ ...d, schedule_type: val }))}
                    className={`flex-1 h-8 rounded-lg text-[13px] font-semibold transition-colors
                      ${(draft.schedule_type || 'weekly') === val ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Weekly day pills ── */}
            {(draft.schedule_type || 'weekly') === 'weekly' && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-2">Days of Week *</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS_OW.map(day => {
                    const on = (draft.days_of_week || []).includes(day.v);
                    return (
                      <button key={day.v} type="button"
                        onClick={() => setDraft(d => ({ ...d, days_of_week: on ? (d.days_of_week || []).filter(x => x !== day.v) : [...(d.days_of_week || []), day.v].sort((a,b) => a-b) }))}
                        className={`w-12 h-9 rounded-lg text-[12.5px] font-bold transition-colors ${on ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>
                        {day.l}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Monthly date grid (1–31) ── */}
            {draft.schedule_type === 'monthly' && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-2">Dates of Month *</label>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                    const on = (draft.monthly_dates || []).includes(d);
                    return (
                      <button key={d} type="button"
                        onClick={() => setDraft(prev => ({
                          ...prev,
                          monthly_dates: on
                            ? (prev.monthly_dates || []).filter(x => x !== d)
                            : [...(prev.monthly_dates || []), d].sort((a,b) => a-b),
                        }))}
                        className={`h-9 rounded-lg text-[12.5px] font-bold transition-colors ${on ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-ink-400">Dates 29–31 are skipped automatically in shorter months.</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1">Start Time</label>
                <select value={draft.start_time} onChange={e => setDraft(d => ({ ...d, start_time: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none">
                  {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1">Hours</label>
                <input type="number" min="1" max="12" value={draft.hours}
                  onChange={e => setDraft(d => ({ ...d, hours: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none"/>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1">Maids</label>
                <input type="number" min="1" max={staffList.length || 99} value={draft.maids}
                  onChange={e => setDraft(d => ({ ...d, maids: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none"/>
              </div>
            </div>

            {staffList.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1.5">
                  Preferred Staff <span className="font-normal normal-case text-ink-400">(auto-assigned if empty)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {staffList.map(s => {
                    const on = (draft.assigned_staff || []).includes(s.id);
                    const c  = STAFF_COLORS[s.color] || STAFF_COLORS.mint;
                    return (
                      <button key={s.id} type="button"
                        onClick={() => setDraft(d => ({ ...d, assigned_staff: on ? (d.assigned_staff||[]).filter(x=>x!==s.id) : [...(d.assigned_staff||[]),s.id] }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium transition-colors hairline ${on ? `${c.bg} ${c.text}` : 'bg-white text-ink-700 hover:bg-ink-50'}`}>
                        <div className={`w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold ${c.bg} ${c.text}`}>{iniT(s.name)}</div>
                        {s.name.split(' ')[0]}
                        {on && <AdminIcon name="check" className="w-3 h-3"/>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1">Notes <span className="font-normal normal-case">(optional)</span></label>
              <textarea value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2} placeholder="Special instructions, entry time, access code…"
                className="w-full p-3 rounded-xl bg-white hairline text-[13px] text-ink-900 placeholder:text-ink-400 outline-none resize-none"/>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
              <div>
                <div className="text-[13px] font-semibold text-ink-800">Schedule Active</div>
                <div className="text-[11.5px] text-ink-500">Inactive schedules won't generate new bookings.</div>
              </div>
              <Switch on={draft.active !== false} onChange={v => setDraft(d => ({ ...d, active: v }))} ariaLabel="Toggle active"/>
            </div>

            {draftErr && (
              <div className="px-3 py-2 rounded-lg bg-red-50 text-[12.5px] text-red-700 font-medium">{draftErr}</div>
            )}

            <div className="flex gap-2 pt-1 border-t border-ink-200">
              <GhostBtn onClick={() => setDraft(null)} className="flex-1">Cancel</GhostBtn>
              <PrimaryBtn onClick={saveDraft} disabled={saving} className="flex-1">
                <AdminIcon name="check" className="w-4 h-4"/>
                {saving ? 'Saving…' : draft.id ? 'Update Schedule' : 'Save & Generate'}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CustomerSection = () => {
  const [customers, setCustomers] = React.useState([]);
  const [bookingSummary, setBookingSummary] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null); // null = add new, string = editing existing
  const [draft, setDraft] = React.useState({ name: '', phone: '', area: '', address: '', tag: 'new' });
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState('');
  const [tab, setTab] = React.useState('all');

  const fetchData = React.useCallback(async () => {
    const [{ data: custs }, { data: bks }] = await Promise.all([
      db('customers').select('*').order('created_at', { ascending: false }),
      db('bookings').select('phone, total, date, status').neq('status', 'Cancelled'),
    ]);
    setCustomers(custs || []);
    const summary = {};
    (bks || []).forEach(b => {
      if (!b.phone) return;
      if (!summary[b.phone]) summary[b.phone] = { count: 0, spent: 0, last: '' };
      summary[b.phone].count += 1;
      summary[b.phone].spent += Number(b.total) || 0;
      if (!summary[b.phone].last || b.date > summary[b.phone].last) summary[b.phone].last = b.date;
    });
    setBookingSummary(summary);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const updateTag = async (id, tag) => {
    setCustomers(cs => cs.map(c => c.id === id ? { ...c, tag } : c));
    await db('customers').update({ tag }).eq('id', id);
  };

  const remove = async (id) => {
    await db('customers').delete().eq('id', id);
    setCustomers(cs => cs.filter(c => c.id !== id));
  };

  const openModal = () => {
    setEditingId(null);
    setDraft({ name: '', phone: '', area: '', address: '', tag: 'new' });
    setFormErr('');
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setDraft({ name: c.name || '', phone: c.phone || '', area: c.area || '', address: c.address || '', tag: c.tag || 'new' });
    setFormErr('');
    setModalOpen(true);
  };

  const saveCustomer = async () => {
    if (!draft.name.trim()) { setFormErr('Name is required.'); return; }
    if (!draft.phone.trim()) { setFormErr('Phone is required.'); return; }
    setFormErr('');
    setSaving(true);
    const payload = { name: draft.name.trim(), phone: draft.phone.trim(), area: draft.area.trim(), address: draft.address.trim(), tag: draft.tag };
    if (editingId) {
      const { error } = await db('customers').update(payload).eq('id', editingId);
      if (error) { setFormErr(error.message); setSaving(false); return; }
      setCustomers(cs => cs.map(c => c.id === editingId ? { ...c, ...payload } : c));
    } else {
      const custId = 'c_' + draft.phone.replace(/\D/g, '').slice(-10) + '_' + Date.now();
      const { error } = await db('customers').insert({ id: custId, ...payload });
      if (error) { setFormErr(error.message); setSaving(false); return; }
      setCustomers(cs => [{ id: custId, ...payload, created_at: new Date().toISOString() }, ...cs]);
    }
    setSaving(false);
    setModalOpen(false);
  };

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  const initials = (name) => (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-5 fade-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Customers", value: customers.length,                                                         icon: "contact", tone: "ink"  },
          { label: "VIP",             value: customers.filter(c => c.tag === 'vip').length,                             icon: "sparkle", tone: "mint" },
          { label: "Active",          value: customers.filter(c => !['inactive'].includes(c.tag)).length,               icon: "check",   tone: "mint" },
          { label: "Inactive",        value: customers.filter(c => c.tag === 'inactive').length,                        icon: "x",       tone: "ink"  },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl2 hairline shadow-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">{k.label}</span>
              <span className={`w-8 h-8 grid place-items-center rounded-lg ${k.tone === "mint" ? "bg-mint-100 text-mint-700" : "bg-ink-100 text-ink-700"}`}>
                <AdminIcon name={k.icon} className="w-4 h-4"/>
              </span>
            </div>
            <div className="mt-3 text-[26px] sm:text-[30px] leading-none font-bold tracking-tight text-ink-900 tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Sub-category tabs */}
      <div className="flex gap-1 bg-white rounded-xl hairline p-1 w-fit shadow-card">
        {[['all', 'All Customers'], ['regulars', '↻ Regulars']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 h-8 rounded-lg text-[13px] font-semibold transition-colors
              ${tab === id ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'regulars' && <RegularsView />}

      {tab === 'all' && (<>
      <Card title="Customer Directory" subtitle="All customers who have made a booking. Updated automatically."
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <AdminIcon name="list" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                className="h-9 pl-8 pr-3 rounded-lg bg-ink-50 hairline text-[13px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)] w-36"/>
            </div>
            <PrimaryBtn size="sm" onClick={openModal}>
              <AdminIcon name="plus" className="w-4 h-4"/>Add New
            </PrimaryBtn>
          </div>
        } padded={false}>
        <div className="hidden md:grid grid-cols-[48px_1.8fr_1.2fr_1fr_90px_100px_100px_48px] gap-3 px-6 py-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-200/70 bg-ink-50/50">
          <div></div><div>Name</div><div>Phone</div><div>Area</div><div>Bookings</div><div>Spent</div><div>Tag</div><div></div>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-center text-[13px] text-ink-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-[13px] text-ink-400">
            {search ? "No customers match your search." : "No customers yet — they'll appear here once a booking is made."}
          </div>
        ) : (
          <ul>
            {filtered.map((c, i) => {
              const s = bookingSummary[c.phone] || { count: 0, spent: 0, last: '' };
              const tag = TAG_META[c.tag] || TAG_META.new;
              return (
                <li key={c.id} className={`px-4 sm:px-6 py-3 ${i ? "border-t border-ink-200/70" : ""}`}>
                  <div className="grid grid-cols-[48px_1fr] md:grid-cols-[48px_1.8fr_1.2fr_1fr_90px_100px_100px_48px] gap-3 items-center">
                    <div className="w-9 h-9 rounded-full bg-mint-100 text-mint-800 flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                      {initials(c.name)}
                    </div>
                    <div className="md:contents space-y-1 md:space-y-0">
                      <div className="font-semibold text-[13.5px] text-ink-900">{c.name}</div>
                      <div className="text-[13px] text-ink-600">{c.phone || '—'}</div>
                      <div className="text-[12.5px] text-ink-500">{c.area || c.address || '—'}</div>
                      <div className="text-[13px] font-mono tabular-nums text-ink-700">{s.count}</div>
                      <div className="text-[13px] font-mono tabular-nums text-ink-700">{s.spent.toLocaleString()} QAR</div>
                      <div>
                        <select value={c.tag || 'new'} onChange={e => updateTag(c.id, e.target.value)}
                          className={`h-7 px-2 rounded-full text-[11.5px] font-semibold border-0 outline-none cursor-pointer ${tag.bg} ${tag.text}`}>
                          {TAGS.map(t => <option key={t} value={t}>{TAG_META[t].label}</option>)}
                        </select>
                      </div>
                      <div className="flex justify-end gap-1">
                        <IconBtn icon="edit" onClick={() => openEdit(c)} title="Edit customer"/>
                        <IconBtn icon="trash" tone="danger" onClick={() => remove(c.id)}/>
                      </div>
                    </div>
                  </div>
                  {s.last && (
                    <div className="mt-1 pl-12 text-[11px] text-ink-400">Last booking: {new Date(s.last + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setModalOpen(false)}/>
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl ring-1 ring-ink-200 p-5 sm:p-6 space-y-4 fade-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-mint-500 grid place-items-center text-ink-900 flex-shrink-0">
                <AdminIcon name={editingId ? "edit" : "contact"} className="w-5 h-5" strokeWidth={2.2}/>
              </div>
              <div className="flex-1">
                <h3 className="text-[16px] font-bold text-ink-900">{editingId ? 'Edit Customer' : 'Add New Customer'}</h3>
                <p className="text-[12.5px] text-ink-500 mt-0.5">{editingId ? 'Update the customer details below.' : 'Fill in the customer details below.'}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 rounded-lg hover:bg-ink-100 grid place-items-center text-ink-500">
                <AdminIcon name="x" className="w-4 h-4"/>
              </button>
            </div>


            <div className="space-y-3">
              <div>
                <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Name *</label>
                <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Ahmed Al Rashid"
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Phone *</label>
                <input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                  placeholder="e.g. +974 5555 1234"
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Area</label>
                <input value={draft.area} onChange={e => setDraft(d => ({ ...d, area: e.target.value }))}
                  placeholder="e.g. Al Waab"
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Address</label>
                <input value={draft.address} onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                  placeholder="e.g. Villa 12, Street 5"
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Tag</label>
                <select value={draft.tag} onChange={e => setDraft(d => ({ ...d, tag: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
                  {TAGS.map(t => <option key={t} value={t}>{TAG_META[t].label}</option>)}
                </select>
              </div>
            </div>

            {formErr && <p className="text-[12.5px] text-red-600 font-medium">{formErr}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 h-10 rounded-lg hairline text-[13.5px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors">
                Cancel
              </button>
              <PrimaryBtn onClick={saveCustomer} disabled={saving} className="flex-1">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Customer'}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
};

const StaffSection = ({ store, set, bookings }) => {
  // pendingChanges: { [staffId]: { status?, skills?, serviceTypes? } }
  const [pendingChanges, setPendingChanges] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [savedOk, setSavedOk] = React.useState(false);

  // Encode real skills + service modes (@prefix) into a single skills array for Supabase
  const encodeSkills = (realSkills, serviceTypes) => [
    ...(realSkills || []),
    ...(serviceTypes || []).map(m => '@' + m),
  ];

  // Mark a change as pending (local UI updates immediately)
  const markPending = (id, patch) => {
    setPendingChanges(p => ({ ...p, [id]: { ...p[id], ...patch } }));
    // Apply locally so UI reflects immediately
    set(prev => ({ staff: prev.staff.map(s => s.id === id ? { ...s, ...patch } : s) }));
  };

  const remove = async (id) => {
    const { error } = await db('staff').delete().eq('id', id);
    if (error) { console.error('Staff delete failed:', error.message); return; }
    set({ staff: store.staff.filter(s => s.id !== id) });
    setPendingChanges(p => { const n = { ...p }; delete n[id]; return n; });
  };

  // Name / nationality — save immediately (not blocked behind Save Changes)
  const updateImmediate = async (id, patch) => {
    set(prev => ({ staff: prev.staff.map(s => s.id === id ? { ...s, ...patch } : s) }));
    await db('staff').update(patch).eq('id', id);
  };

  // Active/On-Hold toggle — optimistic update, reverts if DB write fails
  const toggleActive = async (id) => {
    const s = store.staff.find(x => x.id === id); if (!s) return;
    const next = s.active !== false ? false : true;
    set(prev => ({ staff: prev.staff.map(x => x.id === id ? { ...x, active: next } : x) }));
    const { error } = await db('staff').update({ active: next }).eq('id', id);
    if (error) set(prev => ({ staff: prev.staff.map(x => x.id === id ? { ...x, active: !next } : x) }));
  };

  const toggleSkill = (sid, sk) => {
    const s = store.staff.find(x => x.id === sid); if (!s) return;
    const current = s.skills || [];
    const nextSkills = current.includes(sk) ? current.filter(x => x !== sk) : [...current, sk];
    markPending(sid, { skills: nextSkills });
  };

  const toggleServiceType = (sid, mode) => {
    const s = store.staff.find(x => x.id === sid); if (!s) return;
    const current = s.serviceTypes || [];
    const nextTypes = current.includes(mode) ? current.filter(x => x !== mode) : [...current, mode];
    markPending(sid, { serviceTypes: nextTypes });
  };

  const hasPending = Object.keys(pendingChanges).length > 0;

  const saveAll = async () => {
    setSaving(true);
    setSavedOk(false);
    const failed = [];
    for (const s of store.staff) {
      const dbPatch = {
        skills: encodeSkills(s.skills || [], s.serviceTypes || []),
        working_days: s.working_days ?? [0,1,2,3,4,5,6],
        active: s.active !== false,
      };
      try {
        const { error } = await db('staff').update(dbPatch).eq('id', s.id);
        if (error) {
          if (error.code === 'PGRST204') {
            // active or working_days column not yet in DB — try without active
            const { error: e2 } = await db('staff').update({ skills: dbPatch.skills, working_days: dbPatch.working_days }).eq('id', s.id);
            if (e2) {
              if (e2.code === 'PGRST204') {
                // working_days also missing — just save skills
                const { error: e3 } = await db('staff').update({ skills: dbPatch.skills }).eq('id', s.id);
                if (e3) throw e3;
              } else throw e2;
            }
          } else throw error;
        }
      } catch(e) { failed.push(s.name + ': ' + (e.message || 'network error')); }
    }
    if (failed.length) { alert('Some staff could not be saved:\n' + failed.join('\n')); setSaving(false); return; }
    setPendingChanges({});
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
    setSaving(false);
  };

  const blankDraft = () => ({ name: '', nationality: store.nationalities.find(n => n.on !== false)?.id || '', color: 'mint', skills: [], serviceTypes: [], working_days: [0,1,2,3,4,5,6], active: true });
  const [modalOpen, setModalOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(blankDraft);
  const toggleDraftSkill = (sk) => setDraft(d => ({ ...d, skills: d.skills.includes(sk) ? d.skills.filter(x => x !== sk) : [...d.skills, sk] }));
  const toggleDraftServiceType = (m) => setDraft(d => {
    const types = d.serviceTypes || ['hourly'];
    return { ...d, serviceTypes: types.includes(m) ? types.filter(x => x !== m) : [...types, m] };
  });
  const openModal = () => { setDraft(blankDraft()); setModalOpen(true); };
  const [modalSaving, setModalSaving] = React.useState(false);
  const [modalErr,    setModalErr]    = React.useState('');
  const saveNew = async () => {
    if (!draft.name.trim()) return;
    setModalSaving(true);
    setModalErr('');
    const encodedSkills = encodeSkills(draft.skills, draft.serviceTypes);
    const { data, error } = await db('staff').insert({
      name:         draft.name.trim(),
      nationality:  draft.nationality || '',
      color:        draft.color || 'mint',
      working_days: draft.working_days ?? [0,1,2,3,4,5,6],
      active:       draft.active !== false,
      phone:        draft.phone  || '',
      notes:        draft.notes  || '',
      skills:       encodedSkills,
    }).select().single();
    setModalSaving(false);
    if (error) { setModalErr('Could not save: ' + error.message); return; }
    // Update local state with the real DB record (realtime will also sync)
    set(prev => ({ staff: [...prev.staff, {
      id:           data.id,
      name:         data.name         || '',
      nationality:  data.nationality  || '',
      color:        data.color        || 'mint',
      skills:       (Array.isArray(data.skills) ? data.skills : []).filter(sk => !sk.startsWith('@')),
      serviceTypes: (Array.isArray(data.skills) ? data.skills : []).filter(sk => sk.startsWith('@')).map(sk => sk.slice(1)),
      phone:        data.phone        || '',
      notes:        data.notes        || '',
      working_days: Array.isArray(data.working_days) ? data.working_days : [0,1,2,3,4,5,6],
      active:       data.active !== false,
    }] }));
    setModalOpen(false);
  };
  const totalMaids = store.staff.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const workingToday = store.staff.filter(s => isWorkingDay(s, todayStr)).length;
  const offToday = totalMaids - workingToday;
  const customSchedule = store.staff.filter(s => Array.isArray(s.working_days) && s.working_days.length < 7).length;

  return (
    <div className="space-y-5 fade-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Maids",      value: totalMaids,     icon: "users",   tone: "ink" },
          { label: "Working Today",    value: workingToday,   icon: "check",   tone: "mint" },
          { label: "Off Today",        value: offToday,       icon: "x",       tone: "ink" },
          { label: "Custom Schedule",  value: customSchedule, icon: "calendar",tone: "ink" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl2 hairline shadow-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">{k.label}</span>
              <span className={`w-8 h-8 grid place-items-center rounded-lg ${k.tone === "mint" ? "bg-mint-100 text-mint-700" : "bg-ink-100 text-ink-700"}`}>
                <AdminIcon name={k.icon} className="w-4 h-4"/>
              </span>
            </div>
            <div className="mt-3 text-[26px] sm:text-[30px] leading-none font-bold tracking-tight text-ink-900 tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl2 hairline bg-mint-50 px-4 py-3 flex items-start sm:items-center gap-3 flex-col sm:flex-row">
        <span className="w-9 h-9 rounded-lg bg-mint-500 text-ink-900 grid place-items-center flex-shrink-0">
          <AdminIcon name="sparkle" className="w-4 h-4" strokeWidth={2.2}/>
        </span>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-ink-900">Capacity is linked to live staff</div>
          <div className="text-[12px] text-ink-600">Customer bookings are capped at <span className="font-mono font-semibold">{Math.min(workingToday, store.limits.maxMaids)}</span> maids per slot — the lower of staff working today ({workingToday}) and admin max ({store.limits.maxMaids}).</div>
        </div>
      </div>

      <Card title="Staff Directory" subtitle="Add, edit and manage every maid on the roster."
        action={
          <div className="flex items-center gap-2">
            {savedOk && <span className="flex items-center gap-1 text-[12px] font-semibold text-mint-700"><AdminIcon name="check" className="w-3.5 h-3.5"/>Saved!</span>}
            <PrimaryBtn size="sm" onClick={saveAll} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </PrimaryBtn>
            <button onClick={openModal}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-ink-100 hover:bg-ink-200 text-ink-900 text-[13px] font-semibold transition-colors">
              <AdminIcon name="plus" className="w-4 h-4"/>Add staff
            </button>
          </div>
        } padded={false}>
        <div className="hidden md:grid grid-cols-[56px_1.2fr_1fr_1.8fr_1.2fr_1.4fr_120px_60px] gap-3 px-6 py-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-200/70 bg-ink-50/50">
          <div></div><div>Name</div><div>Nationality</div><div>Working Days</div><div>Services</div><div>Skills</div><div>Status</div><div></div>
        </div>
        <ul>
          {store.staff.map((s, i) => {
            const jobs = Object.values(store.assignments || {}).filter(arr => arr.includes(s.id)).length;
            return (
              <li key={s.id} className={`px-4 sm:px-6 py-3 transition-colors ${i ? "border-t border-ink-200/70" : ""} ${s.active === false ? 'bg-ink-50/70' : ''}`}>
                <div className="grid grid-cols-[48px_1fr] md:grid-cols-[56px_1.2fr_1fr_1.8fr_1.2fr_1.4fr_120px_60px] gap-3 items-center">
                  <StaffAvatar s={s} size={40}/>
                  <div className="md:contents space-y-2 md:space-y-0">
                    <TextField value={s.name} onChange={v => updateImmediate(s.id, { name: v })} />
                    <select value={s.nationality || ''} onChange={e => updateImmediate(s.id, { nationality: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
                      <option value="">— Select —</option>
                      {store.nationalities.filter(n => n.on !== false).map(n => (
                        <option key={n.id} value={n.id}>{n.flag} {n.name}</option>
                      ))}
                      {store.nationalities.filter(n => n.on !== false).length === 0 && (
                        <option disabled>No nationalities — add in Nationalities page</option>
                      )}
                    </select>
                    {/* Working Days — toggles in the "Working Days" column */}
                    <div className="flex flex-wrap gap-1">
                      {[['Su',0],['Mo',1],['Tu',2],['We',3],['Th',4],['Fr',5],['Sa',6]].map(([lbl, i]) => {
                        const wdays = pendingChanges[s.id]?.working_days ?? s.working_days ?? [0,1,2,3,4,5,6];
                        const on = wdays.includes(i);
                        return (
                          <button key={i} onClick={() => {
                            const cur = pendingChanges[s.id]?.working_days ?? s.working_days ?? [0,1,2,3,4,5,6];
                            const next = on ? cur.filter(d => d !== i) : [...cur, i].sort((a,b) => a-b);
                            markPending(s.id, { working_days: next });
                          }}
                            className={`w-8 h-6 rounded text-[10.5px] font-bold transition-colors
                              ${on ? 'bg-mint-500 text-ink-900' : 'bg-white hairline text-ink-400 hover:bg-ink-50'}`}>
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                    {/* Service types — Hourly / Monthly / Stay-In */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'hourly',  label: 'Hourly',  icon: 'broom'    },
                        { id: 'monthly', label: 'Monthly', icon: 'calendar' },
                        { id: 'stayin',  label: 'Stay-In', icon: 'home'     },
                      ].map(m => {
                        const on = (s.serviceTypes || []).includes(m.id);
                        return (
                          <button key={m.id} onClick={() => toggleServiceType(s.id, m.id)}
                            className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11.5px] font-semibold transition-colors
                              ${on ? "bg-mint-500 text-ink-900" : "hairline text-ink-500 hover:bg-ink-50"}`}>
                            {on
                              ? <AdminIcon name="check" className="w-3 h-3"/>
                              : <AdminIcon name={m.icon} className="w-3 h-3"/>}
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Cleaning skills — only clickable when Hourly is enabled */}
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        const hourlyOn = (s.serviceTypes || []).includes('hourly');
                        const allSvcs = [...store.services, ...(store.fixedServices || [])];
                        return allSvcs.map(sv => {
                        const on = s.skills.includes(sv.id);
                        const isFixed = sv.fixedPrice != null;
                        return (
                          <button key={sv.id}
                            disabled={!hourlyOn}
                            onClick={() => hourlyOn && toggleSkill(s.id, sv.id)}
                            title={!hourlyOn ? "Enable Hourly service first" : undefined}
                            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11.5px] font-semibold transition-colors
                              ${!hourlyOn
                                ? "opacity-35 cursor-not-allowed hairline text-ink-400"
                                : on ? (isFixed ? "bg-violet-500 text-white" : "bg-mint-500 text-ink-900") : "hairline text-ink-600 hover:bg-ink-50"}`}>
                            <SvcIcon name={sv.icon} className="w-3.5 h-3.5" strokeWidth={1.75} />
                            {sv.name.split(" ")[0]}
                          </button>
                        );
                        });
                      })()}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => toggleActive(s.id)}
                        title={s.active !== false ? 'Active — click to put on hold' : 'On Hold — click to activate'}
                        className={`h-6 px-2.5 rounded-full text-[10.5px] font-bold transition-colors ${s.active !== false ? 'bg-mint-100 text-mint-800 hover:bg-mint-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>
                        {s.active !== false ? 'Active' : 'On Hold'}
                      </button>
                      <div className="flex items-center gap-1 text-[11px] text-ink-500">
                        <span className="font-mono tabular-nums">{jobs}</span>
                        <span>jobs</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn icon="trash" tone="danger" onClick={() => remove(s.id)}/>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex items-center justify-end gap-3 border-t border-ink-200 mt-4 pt-4">
        {savedOk && <span className="flex items-center gap-1.5 text-[13px] font-semibold text-mint-700"><AdminIcon name="check" className="w-4 h-4"/>Saved!</span>}
        <PrimaryBtn onClick={saveAll} disabled={saving}>
          <AdminIcon name="check" className="w-4 h-4"/>{saving ? "Saving…" : "Save Changes"}
        </PrimaryBtn>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl ring-1 ring-ink-200 p-5 sm:p-6 space-y-4 fade-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-mint-500 grid place-items-center text-ink-900">
                <AdminIcon name="users" className="w-5 h-5" strokeWidth={2.2}/>
              </div>
              <div className="flex-1">
                <h3 className="text-[16px] font-bold text-ink-900">Add new maid</h3>
                <p className="text-[12.5px] text-ink-500 mt-0.5">Fill in the details to add to the roster.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 grid place-items-center rounded-lg text-ink-500 hover:bg-ink-100">
                <AdminIcon name="x" className="w-4 h-4"/>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Full name</Label>
                <TextField value={draft.name} onChange={v => setDraft(d => ({...d, name: v}))} placeholder="e.g. Maria Santos" className="mt-1.5" autoFocus/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nationality</Label>
                  <select value={draft.nationality} onChange={e => setDraft(d => ({...d, nationality: e.target.value}))}
                    className="mt-1.5 w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
                    <option value="">— Select —</option>
                    {store.nationalities.filter(n => n.on !== false).map(n => (
                      <option key={n.id} value={n.id}>{n.flag} {n.name}</option>
                    ))}
                    {store.nationalities.filter(n => n.on !== false).length === 0 && (
                      <option disabled>No nationalities — add in Nationalities page</option>
                    )}
                  </select>
                </div>
                <div>
                  <Label>Working Days</Label>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {[['Su',0],['Mo',1],['Tu',2],['We',3],['Th',4],['Fr',5],['Sa',6]].map(([lbl, i]) => {
                      const wdays = draft.working_days ?? [0,1,2,3,4,5,6];
                      const on = wdays.includes(i);
                      return (
                        <button key={i} type="button" onClick={() => {
                          const next = on ? wdays.filter(d => d !== i) : [...wdays, i].sort((a,b) => a-b);
                          setDraft(d => ({ ...d, working_days: next }));
                        }}
                          className={`w-10 h-8 rounded-lg text-[11.5px] font-bold transition-colors
                            ${on ? 'bg-mint-500 text-ink-900' : 'bg-white hairline text-ink-400 hover:bg-ink-50'}`}>
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div>
                <Label>Avatar color</Label>
                <div className="mt-1.5 flex gap-2">
                  {Object.keys(STAFF_COLORS).map(col => {
                    const c = STAFF_COLORS[col];
                    return (
                      <button key={col} onClick={() => setDraft(d => ({...d, color: col}))}
                        className={`w-8 h-8 rounded-full ${c.bg} ${c.text} ring-2 ${draft.color === col ? "ring-ink-900" : "ring-white"} grid place-items-center font-bold text-[12px]`}>
                        {col[0].toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Service types</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[
                    { id: 'hourly',  label: 'Hourly',  icon: 'broom'    },
                    { id: 'monthly', label: 'Monthly', icon: 'calendar' },
                    { id: 'stayin',  label: 'Stay-In', icon: 'home'     },
                  ].map(m => {
                    const on = (draft.serviceTypes || []).includes(m.id);
                    return (
                      <button key={m.id} onClick={() => toggleDraftServiceType(m.id)}
                        className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[12px] font-semibold transition-colors
                          ${on ? "bg-mint-500 text-ink-900" : "hairline text-ink-500 hover:bg-ink-50"}`}>
                        {on
                          ? <AdminIcon name="check" className="w-3.5 h-3.5"/>
                          : <AdminIcon name={m.icon} className="w-3.5 h-3.5"/>}
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Cleaning skills</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[...store.services, ...(store.fixedServices || [])].map(sv => {
                    const on = draft.skills.includes(sv.id);
                    const isFixed = sv.fixedPrice != null;
                    return (
                      <button key={sv.id} onClick={() => toggleDraftSkill(sv.id)}
                        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] font-semibold transition-colors
                          ${on ? (isFixed ? "bg-violet-500 text-white" : "bg-mint-500 text-ink-900") : "hairline text-ink-600 hover:bg-ink-50"}`}>
                        <SvcIcon name={sv.icon} className="w-3.5 h-3.5" strokeWidth={1.75} />
                        {sv.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {modalErr && <div className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{modalErr}</div>}
            <div className="flex items-center justify-end gap-2 pt-1">
              <GhostBtn size="sm" onClick={() => setModalOpen(false)}>Cancel</GhostBtn>
              <PrimaryBtn size="sm" onClick={saveNew} disabled={!draft.name.trim() || modalSaving}>
                <AdminIcon name="check" className="w-4 h-4"/>{modalSaving ? 'Saving…' : 'Save maid'}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─ 12-hour AM/PM time formatter ─ */
const fmt12 = (h, m = 0) => {
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr}:00 ${ap}` : `${hr}:${String(m).padStart(2,"0")} ${ap}`;
};

/* ─── Daily staff schedule (used inside CalendarSection) ─── */
// Default; overridden per-render from store.businessHours
const DEFAULT_SCHEDULE_HOURS = [8,9,10,11,12,13,14,15,16,17,18,19];
const makeScheduleHours = (open = 8, close = 19) => Array.from({ length: close - open + 1 }, (_, i) => open + i);
const parseHour = (t) => {
  if (!t || t === "—") return null;
  const upper = t.toUpperCase();
  const isPM = upper.includes('PM');
  const isAM = upper.includes('AM');
  const [hStr, mStr] = t.replace(/[^0-9:]/g, '').split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (isNaN(h)) return null;
  let hour = h;
  if (isPM && h !== 12) hour = h + 12;
  if (isAM && h === 12) hour = 0;
  return hour + m / 60;
};

const StaffSchedule = ({ store, bookings, dateKey }) => {
  const { open: bhOpen = 8, close: bhClose = 19 } = store.businessHours || {};
  const SCHEDULE_HOURS = makeScheduleHours(bhOpen, bhClose);
  const todays = bookings.filter(b => bookingDateKey(b) === dateKey && b.status !== "Cancelled");
  const cellH = 56;
  const dateDow = dateKey ? new Date(dateKey + 'T00:00:00').getDay() : null;
  const isOffDay = (s) => {
    if (dateDow === null) return false;
    const days = s.working_days;
    if (!Array.isArray(days)) return false;  // column not in DB → assume working
    if (days.length === 0) return true;      // all days explicitly off → always off today
    return !days.includes(dateDow);
  };

  // On-hold staff are hidden from the calendar entirely
  // Working staff first, off-day staff last, alphabetical within each group
  const staff = [...store.staff].filter(s => s.active !== false).sort((a, b) => {
    const aOff = isOffDay(a) ? 1 : 0;
    const bOff = isOffDay(b) ? 1 : 0;
    if (aOff !== bOff) return aOff - bOff;
    return a.name.localeCompare(b.name);
  });

  const colW = `minmax(72px, 1fr)`;
  const timeColW = '44px';

  return (
    <Card padded={false} title="Daily Staff Schedule"
      subtitle={dateKey ? `Jobs and availability for ${new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}.` : "Pick a date above."}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: `calc(${timeColW} + ${staff.length} * 72px)` }}>
          <div className="grid sticky top-0 z-10 bg-white border-b border-ink-200/70"
               style={{ gridTemplateColumns: `${timeColW} repeat(${staff.length}, ${colW})` }}>
            <div></div>
            {staff.map(s => {
              const off = isOffDay(s);
              return (
                <div key={s.id} className={`flex flex-col items-center gap-1 py-2 px-1 lg:py-3 lg:px-2 ${off ? 'opacity-50' : ''}`}>
                  <StaffAvatar s={s} size={32}/>
                  <div className="text-[11px] lg:text-[13px] font-bold text-ink-900 truncate max-w-full text-center leading-tight">{s.name.split(" ")[0]}</div>
                  <div className={`flex items-center gap-0.5 text-[9px] lg:text-[10.5px] font-mono uppercase tracking-[0.08em] ${off ? 'text-ink-400' : 'text-mint-700 font-semibold'}`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${off ? 'bg-ink-300' : 'bg-mint-500'}`}/>
                    {off ? 'Off' : 'On'}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="relative grid"
               style={{ gridTemplateColumns: `${timeColW} repeat(${staff.length}, ${colW})`, gridAutoRows: `${cellH}px` }}>
            {SCHEDULE_HOURS.map((h, hi) => (
              <div key={`h${h}`} className="border-b border-r border-ink-200/70 text-[9px] lg:text-[10.5px] font-mono text-ink-500 px-1 lg:px-2 pt-1"
                   style={{ gridColumn: 1, gridRow: hi+1 }}>
                {fmt12(h)}
              </div>
            ))}
            {staff.map((s, sIdx) => (
              <React.Fragment key={s.id}>
                {SCHEDULE_HOURS.map((h, hIdx) => {
                  const isOff = isOffDay(s);
                  return (
                    <div key={`${s.id}-${h}`}
                         className={`border-b border-r border-ink-200/70 ${isOff ? "bg-ink-50/60" : "bg-white"}`}
                         style={{ gridColumn: sIdx + 2, gridRow: hIdx + 1 }}/>
                  );
                })}
                {todays.filter(b => {
                  const ids = (b._raw?.assigned_staff?.length > 0)
                    ? b._raw.assigned_staff
                    : (store.assignments?.[b.ref] || []);
                  return ids.includes(s.id);
                }).map(b => {
                  const bookingStart = parseHour(b.time); if (bookingStart == null) return null;
                  const hoursMap = (b._raw?.staff_hours && Object.keys(b._raw.staff_hours).length > 0)
                    ? b._raw.staff_hours
                    : (store.staffHours?.[b.ref] || {});
                  const myHours  = Number(hoursMap[s.id] ?? b.hours);
                  const start    = bookingStart;
                  const startIdx = Math.max(0, start - SCHEDULE_HOURS[0]);
                  const span     = Math.min(SCHEDULE_HOURS.length - startIdx, myHours);
                  if (span <= 0) return null;
                  const c    = STAFF_COLORS[s.color] || STAFF_COLORS.mint;
                  const endT = start + myHours;
                  return (
                    <div key={`${b.ref}-${s.id}`}
                      className={`relative m-0.5 rounded-md ring-1 px-1.5 py-1 lg:m-1 lg:rounded-lg lg:px-2.5 lg:py-1.5 text-left overflow-hidden ${c.block}`}
                      style={{ gridColumn: sIdx + 2, gridRow: `${startIdx + 1} / span ${Math.max(1, Math.ceil(span))}` }}>
                      <div className="text-[8.5px] lg:text-[10.5px] font-mono opacity-80 leading-tight">
                        {fmt12(Math.floor(start), Math.round((start % 1) * 60))}–{fmt12(Math.floor(endT), Math.round((endT % 1) * 60))}
                      </div>
                      <div className="text-[10px] lg:text-[12.5px] font-bold leading-tight mt-0.5 truncate">{b.customer}</div>
                      <div className="text-[9px] lg:text-[11px] opacity-80 truncate">{b.service}</div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

/* ─── Settings (lightweight) ─── */
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = i; // 12 AM (midnight) to 11 PM — full 24-hour range, no limit
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { value: h, label: `${h12}:00 ${ap}` };
});

const SettingsSection = ({ store, set }) => {
  const brand = store.brand || { name:'Maid Pro', whatsapp:'', callNumber:'', country:'qa', currency:'QAR', language:'en', timezone:'Asia/Qatar (GMT+3)', logo:'' }
  const rules = store.bookingRules || { autoConfirm:true, smsReminders:true, guestCheckout:false, idVerification:true, noShowFee:false, maidPhotos:true, autoAssign:true }
  const hours = store.businessHours || { open: 8, close: 19 }
  const setB = p => set({ brand: { ...brand, ...p } })
  const setR = p => set({ bookingRules: { ...rules, ...p } })
  const setH = p => set({ businessHours: { ...hours, ...p } })
  const [saved, setSaved] = React.useState(false)
  const save = async () => {
    setSaved(false)
    try {
      const { error } = await db('settings').upsert([
        { key:'brand', value:brand },
        { key:'bookingRules', value:rules },
        { key:'businessHours', value:hours },
      ], { onConflict: 'company_id,key' })
      if (error) throw error
      broadcastSettingsUpdate()
      setSaved(true); setTimeout(()=>setSaved(false),3000)
    } catch(e) { alert('Save failed: ' + (e.message || 'Network error — check your connection.')) }
  }
  return (
    <div className="space-y-4 fade-up">
      <Card title="Brand Identity" subtitle="Company name, logo and contact details — shown in the sidebar and booking page.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Brand name</Label><TextField value={brand.name} onChange={v=>setB({name:v})} className="mt-2"/></div>
          <div><Label>WhatsApp number</Label><TextField value={brand.whatsapp||''} onChange={v=>setB({whatsapp:v})} placeholder="+974 5000 0000" className="mt-2"/></div>
          <div><Label>Call number</Label><TextField value={brand.callNumber||''} onChange={v=>setB({callNumber:v})} placeholder="+974 4400 0000" className="mt-2"/></div>
          <div className="sm:col-span-2">
            <Label>Country</Label>
            <div className="relative mt-2 max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <Flag code={brand.country || 'qa'} size={22}/>
              </span>
              <select value={brand.country || 'qa'} onChange={e => setB({ country: e.target.value, timezone: timezoneFor(e.target.value) })}
                className="w-full h-10 rounded-xl hairline bg-white pl-10 pr-8 text-[13.5px] text-ink-900 outline-none focus:ring-2 focus:ring-mint-400 appearance-none cursor-pointer">
                {BRAND_COUNTRIES.map(c => <option key={c.iso} value={c.iso}>{c.name} ({c.dial})</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink-500">
              Sets the phone country code (<span className="font-mono">{dialCodeFor(brand.country)}</span>) shown to customers, and the time zone (<span className="font-mono">{timezoneFor(brand.country)}</span>) automatically.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Company Logo</Label>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {brand.logo && (
                <div className="relative group">
                  <img src={brand.logo} alt="Logo" className="h-14 max-w-[140px] rounded-xl object-contain bg-ink-50 p-2 hairline"/>
                  <button onClick={() => setB({ logo: '' })}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] grid place-items-center hover:bg-red-600 shadow">
                    ✕
                  </button>
                </div>
              )}
              <label className="cursor-pointer inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-ink-100 hover:bg-ink-200 text-[13px] font-semibold text-ink-700 transition-colors hairline">
                <AdminIcon name="plus" className="w-4 h-4"/>
                {brand.logo ? 'Change logo' : 'Upload logo'}
                <input type="file" accept="image/*" className="sr-only" onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => setB({ logo: ev.target.result });
                  reader.readAsDataURL(file);
                }}/>
              </label>
              <p className="text-[11.5px] text-ink-500">PNG, JPG or SVG · shown in sidebar &amp; booking page</p>
            </div>
          </div>
          <div>
            <Label>Currency</Label>
            <div className="relative mt-2">
              <select value={brand.currency || 'QAR'} onChange={e => setB({ currency: e.target.value })}
                className="w-full h-10 rounded-xl hairline bg-white pl-3 pr-8 text-[13.5px] text-ink-900 outline-none focus:ring-2 focus:ring-mint-400 appearance-none cursor-pointer">
                {[
                  ['AED','AED — UAE Dirham'],
                  ['QAR','QAR — Qatari Riyal'],
                  ['SAR','SAR — Saudi Riyal'],
                  ['KWD','KWD — Kuwaiti Dinar'],
                  ['BHD','BHD — Bahraini Dinar'],
                  ['OMR','OMR — Omani Rial'],
                  ['USD','USD — US Dollar'],
                  ['EUR','EUR — Euro'],
                  ['GBP','GBP — British Pound'],
                  ['CAD','CAD — Canadian Dollar'],
                  ['AUD','AUD — Australian Dollar'],
                  ['SGD','SGD — Singapore Dollar'],
                  ['INR','INR — Indian Rupee'],
                  ['PKR','PKR — Pakistani Rupee'],
                  ['EGP','EGP — Egyptian Pound'],
                ].map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
          <div>
            <Label>Language</Label>
            <div className="relative mt-2">
              <select value={brand.language || 'en'} onChange={e => setB({ language: e.target.value })}
                className="w-full h-10 rounded-xl hairline bg-white pl-3 pr-8 text-[13.5px] text-ink-900 outline-none focus:ring-2 focus:ring-mint-400 appearance-none cursor-pointer">
                {[
                  ['en','English'],
                  ['ar','Arabic (العربية)'],
                  ['fr','French (Français)'],
                  ['es','Spanish (Español)'],
                  ['de','German (Deutsch)'],
                  ['ur','Urdu (اردو)'],
                  ['hi','Hindi (हिन्दी)'],
                  ['tl','Filipino (Tagalog)'],
                  ['bn','Bengali (বাংলা)'],
                  ['ru','Russian (Русский)'],
                  ['tr','Turkish (Türkçe)'],
                ].map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Auto Assign" subtitle="Automatically route each new booking to the right maid — no manual picking needed.">
        <div className={`flex items-start justify-between gap-4 rounded-xl px-4 py-4 transition-all
          ${rules.autoAssign ? "bg-mint-50 ring-1 ring-mint-300" : "bg-ink-50 hairline"}`}>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold text-ink-900">Enable Auto Assign</div>
            <div className="text-[12px] text-ink-500 mt-0.5">
              When on, every new booking is assigned to the maid with the <span className="font-semibold">fewest active jobs</span>. Only maids whose <span className="font-semibold">working days</span> match the booking date are considered.
            </div>
          </div>
          <Switch on={!!rules.autoAssign} onChange={v => setR({ autoAssign: v })} ariaLabel="Auto Assign"/>
        </div>
        {rules.autoAssign && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-mint-700 font-medium">
            <AdminIcon name="check" className="w-3.5 h-3.5 flex-shrink-0"/>
            Auto Assign is active — new bookings will be assigned automatically.
          </div>
        )}
      </Card>

      <Card title="Business Hours" subtitle="Set the opening and closing time for customer bookings. Slots outside these hours are hidden.">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <Label>Opening time</Label>
            <div className="relative mt-2">
              <select value={hours.open} onChange={e => setH({ open: Number(e.target.value) })}
                className="w-full h-10 pl-3 pr-8 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:ring-2 focus:ring-mint-400 appearance-none cursor-pointer">
                {HOUR_OPTIONS.filter(o => o.value < hours.close).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
          <div>
            <Label>Closing time</Label>
            <div className="relative mt-2">
              <select value={hours.close} onChange={e => setH({ close: Number(e.target.value) })}
                className="w-full h-10 pl-3 pr-8 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:ring-2 focus:ring-mint-400 appearance-none cursor-pointer">
                {HOUR_OPTIONS.filter(o => o.value > hours.open).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 px-3 py-2.5 rounded-lg bg-ink-50 text-[12.5px] text-ink-600 leading-snug">
          <AdminIcon name="calendar" className="w-3.5 h-3.5 flex-shrink-0"/>
          <span>Customers can book from</span>
          <span className="font-semibold">{HOUR_OPTIONS.find(o=>o.value===hours.open)?.label}</span>
          <span>to</span>
          <span className="font-semibold">{HOUR_OPTIONS.find(o=>o.value===hours.close)?.label}</span>
          <span>· {hours.close - hours.open} hour window</span>
        </div>
      </Card>

      <Card title="Notifications" subtitle="Control which sounds and alerts the admin panel plays.">
        <div className={`rounded-xl px-4 py-4 transition-all space-y-3
          ${rules.bookingSound !== false ? 'bg-mint-50 ring-1 ring-mint-300' : 'bg-ink-50 hairline'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className={`w-9 h-9 rounded-xl grid place-items-center flex-shrink-0 text-[20px] ${rules.bookingSound !== false ? 'bg-mint-100' : 'bg-ink-100'}`}>🔔</span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-ink-900">Booking notification sound</div>
                <div className="text-[12px] text-ink-500 mt-0.5 leading-snug">Play a chime when a new booking is received in real-time.</div>
              </div>
            </div>
            <Switch on={rules.bookingSound !== false} onChange={v => { setR({ bookingSound: v }); if (v) playBookingChime(); }} ariaLabel="Booking notification sound"/>
          </div>
          {rules.bookingSound !== false && (
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-mint-200">
              <button onClick={playBookingChime}
                className="flex items-center gap-2 h-8 px-4 rounded-lg bg-white ring-1 ring-mint-300 text-[12.5px] font-semibold text-mint-700 hover:bg-mint-50 transition-colors">
                🔔 Test sound
              </button>
              <span className="text-[12px] text-ink-500">Click to preview the notification chime.</span>
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 border-t border-ink-200 mt-2 pt-4">
        {saved && <span className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-mint-700"><AdminIcon name="check" className="w-4 h-4"/>Saved!</span>}
        <PrimaryBtn onClick={save} className="w-full sm:w-auto justify-center"><AdminIcon name="check" className="w-4 h-4"/>Save Changes</PrimaryBtn>
      </div>
    </div>
  )
};

/* ─── Root App ─── */


/* --- Overview Charts --- */
const OverviewCharts = ({ bookings }) => {
  const today = new Date()
  const todayStr = today.toISOString().slice(0,10)
  const days = Array.from({length:14},(_,i)=>{ const d=new Date(today); d.setDate(d.getDate()-13+i); return d.toISOString().slice(0,10) })
  const data = days.map(day => {
    const bks = bookings.filter(b => b._raw && b._raw.date === day)
    return { day, label: String(new Date(day+'T12:00').getDate()), count: bks.length,
      revenue: bks.filter(b=>!isCancelledBooking(b)).reduce((s,b)=>s+b.total,0) }
  })
  const maxC = Math.max(...data.map(d=>d.count),1)
  const maxR = Math.max(...data.map(d=>d.revenue),1)
  const W=540,H=100,PY=20,bw=W/14
  const lp = data.map((d,i)=>({x:i*bw+bw/2, y:H-(d.revenue/maxR)*(H-4)+2}))
  const linePath = lp.map((p,i)=>(i===0?'M ':'L ')+p.x+' '+p.y).join(' ')
  const areaPath = 'M '+lp[0].x+' '+H+' '+lp.map(p=>'L '+p.x+' '+p.y).join(' ')+' L '+lp[13].x+' '+H+' Z'
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl2 hairline shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">Bookings last 14 days</div>
          <div className="text-[13px] font-bold text-ink-900 font-mono">{bookings.length} total</div>
        </div>
        <svg viewBox={'0 0 '+W+' '+(H+PY)} className="w-full" style={{overflow:'visible'}}>
          {data.map((d,i)=>{const h=Math.max((d.count/maxC)*(H-8),d.count?3:0),x=i*bw+bw/2,y=H-h
            return (<g key={i}><rect x={x-bw*0.36} y={y} width={bw*0.72} height={h} fill={d.day===todayStr?'oklch(0.52 0.11 168)':'oklch(0.72 0.13 168)'} rx="2" opacity={d.count?1:0.15}/>{d.count>0&&<text x={x} y={y-3} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">{d.count}</text>}<text x={x} y={H+PY-1} textAnchor="middle" fontSize="8" fill="#9ca3af">{d.label}</text></g>)
          })}
          <line x1="0" y1={H} x2={W} y2={H} stroke="#f3f4f6"/>
        </svg>
      </div>
      <div className="bg-white rounded-xl2 hairline shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">Total Revenue (QAR) last 14 days</div>
          <div className="text-[13px] font-bold text-ink-900 font-mono">{data.reduce((s,d)=>s+d.revenue,0).toLocaleString()} QAR</div>
        </div>
        <svg viewBox={'0 0 '+W+' '+(H+PY)} className="w-full" style={{overflow:'visible'}}>
          <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="oklch(0.72 0.13 168)" stopOpacity="0.25"/><stop offset="100%" stopColor="oklch(0.72 0.13 168)" stopOpacity="0"/></linearGradient></defs>
          {maxR>1&&<><path d={areaPath} fill="url(#revGrad)"/><path d={linePath} fill="none" stroke="oklch(0.62 0.13 168)" strokeWidth="2"/>{lp.map((p,i)=>data[i].revenue>0&&<circle key={i} cx={p.x} cy={p.y} r="3" fill="oklch(0.62 0.13 168)" stroke="#fff" strokeWidth="1.5"/>)}</>}
          {maxR<=1&&<text x={W/2} y={H/2} textAnchor="middle" fontSize="11" fill="#d1d5db">No revenue yet</text>}
          {data.map((d,i)=><text key={i} x={i*bw+bw/2} y={H+PY-1} textAnchor="middle" fontSize="8" fill="#9ca3af">{d.label}</text>)}
          <line x1="0" y1={H} x2={W} y2={H} stroke="#f3f4f6"/>
        </svg>
      </div>
    </div>
  )
}

/* --- Booking Detail Modal --- */
const BOOKING_STATUSES = ['Pending','Confirmed','Completed','Cancelled']

/* ── Confirmation receipt helpers ── */
const buildReceiptHTML = (booking, brand, editDate, editTime) => {
  const bName = brand?.name || 'Maid Pro'
  const currency = brand?.currency || 'QAR'
  const date = editDate || booking.date || ''
  const time = editTime || booking.time || ''
  const dateFmt = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : date
  const address = booking._raw?.address || ''
  const rows = [
    ['Customer', booking.customer || '—'],
    ['Phone', booking.phone || '—'],
    ['Service', booking.service || '—'],
    ['Date', dateFmt],
    ['Time', time],
    ['Maids', String(booking.maids)],
    ['Duration', `${booking.hours} hours`],
    address ? ['Address', address] : null,
  ].filter(Boolean)
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Booking Receipt</title><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:40px 20px;color:#111}
    .card{background:#fff;border-radius:16px;max-width:440px;margin:0 auto;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .head{text-align:center;margin-bottom:24px}
    .head h1{font-size:22px;font-weight:800;color:#059669}
    .badge{display:inline-block;margin-top:6px;padding:4px 14px;background:#d1fae5;color:#065f46;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
    .ref{text-align:center;font-family:monospace;font-size:13px;color:#6b7280;margin-bottom:20px}
    table{width:100%;border-collapse:collapse}
    td{padding:9px 4px;font-size:13.5px;border-bottom:1px solid #f3f4f6}
    td:first-child{color:#6b7280;font-weight:500;width:42%}
    td:last-child{font-weight:600;text-align:right}
    .total td{font-size:15px;font-weight:800;color:#059669;border-bottom:none;border-top:2px solid #d1fae5;padding-top:12px}
    .foot{text-align:center;margin-top:28px;font-size:12px;color:#9ca3af;line-height:1.6}
    @media print{body{background:#fff;padding:0}.card{box-shadow:none;border-radius:0}}
  </style></head><body>
  <div class="card">
    <div class="head"><h1>${bName}</h1><span class="badge">✓ Booking Confirmed</span></div>
    <div class="ref">Booking Ref: <strong>${booking.ref}</strong></div>
    <table>${rows.map(([l,v])=>`<tr><td>${l}</td><td>${v}</td></tr>`).join('')}
      <tr class="total"><td>Total</td><td>${currency} ${(Number(booking.total)||0).toLocaleString()}</td></tr>
    </table>
    <div class="foot">Thank you for choosing ${bName}!<br>We look forward to serving you.</div>
  </div>
  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`
}

const ConfirmSendModal = ({ booking, brand, editDate, editTime, onDone }) => {
  const rawPhone = (booking.phone || '').replace(/[\s\-\(\)]/g, '')
  const waPhone = rawPhone.startsWith('00') ? rawPhone.slice(2) : rawPhone.replace(/^\+/, '')
  const currency = brand?.currency || 'QAR'
  const bName = brand?.name || 'Maid Pro'
  const date = editDate || booking.date || ''
  const time = editTime || booking.time || ''
  const dateFmt = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : date

  const waLines = [
    `✅ *Booking Confirmed — ${bName}*`,
    ``,
    `Hello ${booking.customer || 'there'} 👋`,
    `Your booking has been confirmed!`,
    ``,
    `📋 *Ref:* ${booking.ref}`,
    `📅 *Date:* ${dateFmt}`,
    `⏰ *Time:* ${time}`,
    `🧹 *Service:* ${booking.service || '—'}`,
    `👥 *Maids:* ${booking.maids}`,
    `⏱ *Duration:* ${booking.hours} hours`,
    `💰 *Total:* ${currency} ${(Number(booking.total)||0).toLocaleString()}`,
    booking._raw?.address ? `📍 *Address:* ${booking._raw.address}` : null,
    ``,
    `Thank you for choosing ${bName}! 🌟`,
  ].filter(x => x !== null).join('\n')

  const openWhatsApp = () => {
    if (!waPhone) { alert('No phone number on this booking.'); return }
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(waLines)}`, '_blank')
  }

  const download = () => {
    const html = buildReceiptHTML(booking, brand, editDate, editTime)
    const win = window.open('', '_blank')
    if (!win) { alert('Allow pop-ups in your browser to download the receipt.'); return }
    win.document.write(html)
    win.document.close()
  }

  return (
    <div className="absolute inset-0 bg-white rounded-[inherit] z-20 flex flex-col items-center justify-center p-6 text-center gap-4 overflow-y-auto">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-mint-50 text-mint-600 grid place-items-center flex-shrink-0">
        <AdminIcon name="check" className="w-9 h-9" strokeWidth={2.4}/>
      </div>
      <div>
        <div className="text-[19px] font-extrabold text-ink-900 tracking-tight">Booking Confirmed!</div>
        <div className="text-[13px] text-ink-500 mt-1">Send confirmation to customer</div>
      </div>

      {/* Mini receipt preview */}
      <div className="w-full bg-ink-50 rounded-xl p-4 text-left space-y-1 text-[12.5px]">
        <div className="font-mono font-bold text-ink-900 text-[13px]">{booking.ref}</div>
        <div className="text-ink-700 font-medium">{booking.customer}{booking.phone ? ` · ${booking.phone}` : ''}</div>
        <div className="text-ink-500">{dateFmt}{time ? ` at ${time}` : ''}</div>
        <div className="text-ink-500">{booking.service} · {booking.maids} maid{booking.maids > 1 ? 's' : ''} · {booking.hours}h</div>
        <div className="font-bold text-mint-700 text-[13.5px] pt-1">{currency} {(Number(booking.total)||0).toLocaleString()}</div>
      </div>

      {/* Action buttons */}
      <div className="w-full space-y-2.5">
        <button onClick={openWhatsApp}
          className="w-full h-12 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2.5 transition-colors"
          style={{ background: '#25D366' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </button>
        <button onClick={download}
          className="w-full h-12 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-bold text-[14px] flex items-center justify-center gap-2.5 transition-colors">
          <AdminIcon name="download" className="w-5 h-5"/>
          Download Receipt
        </button>
        <button onClick={onDone}
          className="w-full h-10 rounded-xl hairline text-[13.5px] font-semibold text-ink-700 hover:bg-ink-100 transition-colors">
          Done
        </button>
      </div>
    </div>
  )
}

const BookingDetailModal = ({ booking, store, set, onClose }) => {
  const [status, setStatus] = React.useState(
    BOOKING_STATUSES.includes(booking.status) ? booking.status : 'Pending'
  )
  const [notes, setNotes] = React.useState(booking._raw?.notes || '')
  // Keep as string so the user can freely type decimals (e.g. "10.50")
  const [paidAmount, setPaidAmount] = React.useState(
    String(booking._raw?.paid_amount ?? 0)
  )
  const [payMethod, setPayMethod] = React.useState(
    booking._raw?.payment_method || 'Cash'
  )
  const [editDate, setEditDate] = React.useState(booking._raw?.date || '')
  const [editTime, setEditTime] = React.useState(booking._raw?.time || booking.time || '')
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const [cancelReason, setCancelReason] = React.useState('')
  const [cancelling, setCancelling] = React.useState(false)
  const [showConfirmSend, setShowConfirmSend] = React.useState(false)
  const isCancelled = booking.status === 'Cancelled'
  const total = Number(booking.total) || 0
  const paidNum = parseFloat(paidAmount) || 0
  const due = Math.max(0, total - paidNum)

  // Auto-complete when fully paid
  React.useEffect(() => {
    if (total > 0 && paidNum >= total && status !== 'Cancelled' && status !== 'Completed') {
      setStatus('Completed')
    }
  }, [paidNum, total])

  // ── Staff hours helpers ───────────────────────────────────────────────────
  // All maids work the FULL booking duration simultaneously.
  // staff_hours stores per-maid overrides (e.g. a maid left early).
  const totalBookingHours = Number(booking._raw?.hours ?? booking.hours ?? 4)
  const assignedIds       = store.assignments?.[booking.ref] || []
  const rawHrsMap         = store.staffHours?.[booking.ref]  || {}
  // Default: each maid works the full booking duration
  const currentStaffHrs   = Object.fromEntries(
    assignedIds.map(sid => [
      sid,
      rawHrsMap[sid] != null ? Number(rawHrsMap[sid]) : totalBookingHours,
    ])
  )
  const allHoursMatch = assignedIds.every(sid => Math.abs((currentStaffHrs[sid] || 0) - totalBookingHours) < 0.05)

  const updateStaffHours = async (staffId, hrs) => {
    const updated = { ...rawHrsMap, [staffId]: Math.max(0.5, Number(hrs)) }
    set({ staffHours: { ...(store.staffHours || {}), [booking.ref]: updated } })
    if (booking._raw?.id)
      await db('bookings').update({ staff_hours: updated }).eq('id', booking._raw.id)
  }
  const resetToFullHours = async () => {
    if (!assignedIds.length) return
    // Reset every maid back to the full booking duration (simultaneous work)
    const updated = Object.fromEntries(assignedIds.map(id => [id, totalBookingHours]))
    set({ staffHours: { ...(store.staffHours || {}), [booking.ref]: updated } })
    if (booking._raw?.id)
      await db('bookings').update({ staff_hours: updated }).eq('id', booking._raw.id)
  }

  const save = async () => {
    if (!booking._raw?.id) { setSaveError('Booking has no database ID — cannot save.'); return }
    setSaving(true)
    setSaveError('')
    // Reschedule guard: if the date/time moved, ensure none of this booking's
    // assigned maids now overlap another job. Exclude this booking itself.
    if (status !== 'Cancelled' && assignedIds.length > 0) {
      const dayBookings = await fetchDayBookings(supabase, getScopedCompany(), editDate)
      const ns = parseTimeToHours(editTime)
      const ne = ns + (totalBookingHours || 0)
      for (const sid of assignedIds) {
        const conflict = findConflictInRows(dayBookings, sid, ns, ne, booking._raw.id)
        if (conflict) {
          const nm = (store.staff || []).find(s => s.id === sid)?.name || 'An assigned maid'
          setSaving(false)
          setSaveError(`${nm} is already booked ${conflict.range} (Ref ${conflict.ref}) on ${editDate}. Reassign that maid or pick another time.`)
          return
        }
      }
    }
    const { error } = await db('bookings').update({
      status,
      notes,
      date:           editDate,
      time:           editTime,
      paid_amount:    paidNum,
      payment_method: payMethod,
      staff_hours:    store.staffHours?.[booking.ref] || {},
    }).eq('id', booking._raw.id)
    setSaving(false)
    if (!error) {
      if (status === 'Confirmed') {
        setShowConfirmSend(true)
      } else {
        onClose(true)
      }
    } else {
      console.error('save booking error:', error)
      setSaveError(error.message || 'Failed to save. Check Supabase columns exist.')
    }
  }

  const cancelBooking = async () => {
    if (!booking._raw?.id || !cancelReason.trim()) return
    setCancelling(true)
    const existingNotes = notes.trim()
    const updatedNotes = `[Cancellation reason: ${cancelReason.trim()}]${existingNotes ? '\n\n' + existingNotes : ''}`
    // Cancelling deletes the payment: zero the received amount so it never counts
    // toward revenue, received, or outstanding anywhere.
    await db('bookings')
      .update({ status: 'Cancelled', notes: updatedNotes, paid_amount: 0 })
      .eq('id', booking._raw.id)
    setCancelling(false)
    onClose(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-4">
      <div className="absolute inset-0 bg-ink-950/50" onClick={() => onClose(false)}/>
      {/* Mobile: slides up from bottom as full-width sheet. Desktop: centred card. */}
      <div className="relative mt-auto sm:mt-0 w-full sm:max-w-lg bg-white sm:rounded-2xl shadow-xl ring-1 ring-ink-200 overflow-y-auto"
        style={{
          maxHeight: 'calc(100dvh - 48px)',
          borderRadius: '20px 20px 0 0',
        }}
        // override border-radius on sm+
      >
        {showConfirmSend && (
          <ConfirmSendModal
            booking={booking}
            brand={store.brand}
            editDate={editDate}
            editTime={editTime}
            onDone={() => onClose(true)}
          />
        )}
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-ink-200"/>
        </div>
        <div className="px-5 pb-6 pt-3 sm:pt-5 sm:px-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-mint-50 text-mint-700 grid place-items-center flex-shrink-0"><AdminIcon name="list" className="w-5 h-5"/></div>
          <div className="flex-1 min-w-0"><div className="font-bold text-ink-900 text-[16px] font-mono">{booking.ref}</div><div className="text-[12px] text-ink-500">{booking.date} {booking.time}</div></div>
          <button onClick={() => onClose(false)} className="w-10 h-10 grid place-items-center rounded-xl text-ink-500 hover:bg-ink-100"><AdminIcon name="x" className="w-5 h-5"/></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[['Customer',booking.customer],['Phone',booking.phone],['Service',booking.service],['Mode',booking.mode],['Maids x Hours',booking.maids+' x '+booking.hours+'h'],['Total','QAR '+booking.total.toLocaleString()]].map(([l,v])=>(
            <div key={l} className="p-3 rounded-xl bg-ink-50"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">{l}</div><div className="mt-0.5 text-[13px] font-medium text-ink-900 truncate">{v||'---'}</div></div>
          ))}
        </div>
        {booking._raw && booking._raw.address && (
          <div className="p-3 rounded-xl bg-ink-50"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 mb-0.5">Address</div><div className="text-[13px] text-ink-900">{booking._raw.address}</div></div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="flex items-center gap-3 rounded-xl bg-ink-100 px-4 py-3">
            <span className="w-8 h-8 rounded-full bg-ink-300 grid place-items-center flex-shrink-0">
              <AdminIcon name="x" className="w-4 h-4 text-ink-600"/>
            </span>
            <div>
              <div className="text-[13.5px] font-bold text-ink-700">Booking Cancelled</div>
              <div className="text-[12px] text-ink-500">This booking has been cancelled. No changes can be made.</div>
            </div>
          </div>
        )}

        {!isCancelled && (<>
        <div><Label className="mb-1.5">Status</Label><select value={status} onChange={e => setStatus(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none">{BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>

        {/* Reschedule */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5">Date</Label>
            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
          </div>
          <div>
            <Label className="mb-1.5">Time</Label>
            <select value={editTime} onChange={e => setEditTime(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
              {HOUR_OPTIONS.map(o => <option key={o.value} value={o.label}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Payment section */}
        <div className="rounded-xl bg-ink-50 p-4 space-y-3">
          <Label>Payment</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1">Amount Paid (QAR)</div>
              <input type="number" min="0" step="0.01" value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                onBlur={e => { if (e.target.value === '' || isNaN(parseFloat(e.target.value))) setPaidAmount('0') }}
                className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1">Payment Method</div>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
                {['Cash','Card','Bank Transfer','QR Pay'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-600">Total: <span className="font-bold text-ink-900 font-mono">QAR {total.toLocaleString()}</span></span>
            <span className="text-ink-600">Paid: <span className="font-bold text-mint-700 font-mono">QAR {paidNum.toLocaleString()}</span></span>
            <span className={`font-bold font-mono ${due > 0 ? 'text-red-600' : 'text-mint-700'}`}>
              Due: QAR {due.toLocaleString()}
            </span>
          </div>
          {due === 0 && paidNum > 0 && (
            <div className="flex items-center gap-1.5 text-[12px] text-mint-700 font-semibold">
              <AdminIcon name="check" className="w-3.5 h-3.5"/>Fully paid
            </div>
          )}
        </div>

        <div><Label className="mb-1.5">Notes</Label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notes..." className="w-full p-3 rounded-xl bg-white hairline text-[13px] text-ink-900 placeholder:text-ink-400 outline-none resize-none"/></div>
        <div><Label className="mb-1.5">Assign staff</Label><AssignStaff booking={booking} store={store} set={set}/></div>
        </>)}{/* end !isCancelled */}

        {/* Read-only notes when cancelled (shows cancellation reason) */}
        {isCancelled && notes && (
          <div className="p-3 rounded-xl bg-ink-50">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 mb-1">Notes</div>
            <div className="text-[13px] text-ink-700 whitespace-pre-wrap">{notes}</div>
          </div>
        )}

        {/* ── Staff Hours Editor ── */}
        {!isCancelled && assignedIds.length > 0 && (
          <div className="rounded-xl bg-ink-50 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label>Staff Work Hours <span className="text-[11px] font-normal text-ink-400 ml-1">(all maids work simultaneously)</span></Label>
              <button onClick={resetToFullHours}
                className="text-[12px] font-semibold text-mint-700 hover:underline">
                Reset to {totalBookingHours}h each
              </button>
            </div>
            {assignedIds.map(sid => {
              const staffMember = (store.staff || []).find(s => s.id === sid)
              if (!staffMember) return null
              const hrs = currentStaffHrs[sid] || 0
              return (
                <div key={sid} className="flex items-center gap-3">
                  <StaffAvatar s={staffMember} size={28}/>
                  <div className="flex-1 text-[13px] font-medium text-ink-800 truncate">{staffMember.name}</div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateStaffHours(sid, hrs - 0.5)}
                      className="w-6 h-6 rounded-lg bg-white hairline text-ink-700 font-bold text-[14px] grid place-items-center hover:bg-ink-100">−</button>
                    <span className="w-14 text-center text-[13px] font-mono font-bold text-ink-900">{hrs.toFixed(1)}h</span>
                    <button onClick={() => updateStaffHours(sid, hrs + 0.5)}
                      className="w-6 h-6 rounded-lg bg-white hairline text-ink-700 font-bold text-[14px] grid place-items-center hover:bg-ink-100">+</button>
                  </div>
                </div>
              )
            })}
            <div className={`pt-2 border-t border-ink-200 flex items-center justify-between text-[11.5px] font-mono
              ${allHoursMatch ? 'text-mint-700' : 'text-amber-600'}`}>
              <span>Booking: {totalBookingHours}h × {assignedIds.length} maid{assignedIds.length > 1 ? 's' : ''} simultaneously</span>
              {allHoursMatch
                ? <span className="flex items-center gap-1 font-semibold"><AdminIcon name="check" className="w-3 h-3"/>All match</span>
                : <span className="font-semibold">Custom hours set</span>}
            </div>
          </div>
        )}

        {saveError && (
          <div className="px-3 py-2 rounded-lg bg-red-50 text-[12.5px] text-red-700 font-medium">{saveError}</div>
        )}
        {/* Cancel confirmation panel */}
        {!isCancelled && confirmCancel && (
          <div className="rounded-xl bg-red-50 ring-1 ring-red-200 p-4 space-y-3">
            <div className="text-[13.5px] font-bold text-red-700">Cancel this booking?</div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-red-600 mb-1.5">Reason for cancellation *</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g. Customer requested to cancel, schedule conflict, double booking…"
                rows={2}
                className="w-full p-2.5 rounded-lg bg-white ring-1 ring-red-200 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none resize-none focus:ring-2 focus:ring-red-400"/>
            </div>
            <div className="flex gap-2">
              <button onClick={cancelBooking} disabled={cancelling || !cancelReason.trim()}
                className="h-9 px-4 rounded-lg bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {cancelling ? '…' : 'Yes, cancel booking'}
              </button>
              <button onClick={() => { setConfirmCancel(false); setCancelReason('') }}
                className="h-9 px-3 rounded-lg hairline text-[13px] font-semibold text-ink-700 hover:bg-ink-100 transition-colors">
                Keep booking
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-ink-200"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}>
          {!isCancelled && !confirmCancel && (
            <button onClick={() => setConfirmCancel(true)}
              className="mr-auto flex items-center gap-1.5 h-9 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors">
              <AdminIcon name="x" className="w-4 h-4"/>Cancel Booking
            </button>
          )}
          <GhostBtn onClick={() => onClose(false)}>Close</GhostBtn>
          {!isCancelled && (
            <PrimaryBtn onClick={save} disabled={saving}><AdminIcon name="check" className="w-4 h-4"/>{saving ? 'Saving...' : 'Save changes'}</PrimaryBtn>
          )}
        </div>
        </div>{/* end px-5 padding wrapper */}
      </div>
    </div>
  )
}

/* --- New Booking Modal --- */
// Derive the next ref from the highest existing ref — NOT the row count.
// Using count breaks after any deletion (count < max ref number → regenerates
// an existing ref → "duplicate key value violates unique constraint Bookings_ref_key").
const mkRef = async () => {
  const { data } = await db('bookings')
    .select('ref').order('id', { ascending: false }).limit(1);
  let base = 0;
  if (data?.[0]?.ref) {
    const m = String(data[0].ref).match(/^MP-(\d+)$/);
    if (m) base = parseInt(m[1], 10);
  }
  return `MP-${String(base + 1).padStart(3, '0')}`;
};

const NewBookingModal = ({ store, onClose }) => {
  // Fetch all services fresh from Supabase so modal always has up-to-date list
  const [svcs, setSvcs] = React.useState((store.services||[]))
  React.useEffect(() => {
    db('settings').select('value').eq('key','services').maybeSingle()
      .then(({ data }) => {
        if (data?.value && Array.isArray(data.value) && data.value.length) {
          setSvcs(data.value)
          // Update selected service to first in fresh list if not yet set
          setF(prev => prev.service === '' || prev.service === 'Regular Cleaning'
            ? { ...prev, service: data.value[0]?.name || 'Regular Cleaning' }
            : prev)
        }
      })
  }, [])
  const defSvc = svcs[0]?.name || 'Regular Cleaning'
  const defDate = (() => { const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; })()
  const [f, setF] = React.useState({ name:'', phone:'', service:defSvc, date:defDate, time:'9:00 AM', hours:3, cleaners:1, rate:15, total:45, address:'', notes:'', status:'Pending', manualStaff:[] })
  const upd = p => setF(prev => ({ ...prev, ...p }))
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState('')

  /* ── Customer picker state ── */
  const [allCustomers, setAllCustomers] = React.useState([])
  const [custQuery, setCustQuery] = React.useState('')
  const [dropOpen, setDropOpen] = React.useState(false)
  const [selectedCust, setSelectedCust] = React.useState(null) // null = new customer
  const dropRef = React.useRef(null)

  React.useEffect(() => {
    db('customers').select('*').order('name').then(({ data }) => setAllCustomers(data || []))
  }, [])

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredCusts = custQuery.trim()
    ? allCustomers.filter(c =>
        c.name?.toLowerCase().includes(custQuery.toLowerCase()) ||
        (c.phone || '').includes(custQuery)
      )
    : allCustomers

  const selectCustomer = (c) => {
    setSelectedCust(c)
    setCustQuery(c.name)
    upd({ name: c.name, phone: c.phone || '', address: c.address || c.area || '' })
    setDropOpen(false)
  }

  const selectNew = () => {
    setSelectedCust(null)
    upd({ name: custQuery, phone: '', address: '' })
    setDropOpen(false)
  }

  const clearCustomer = () => {
    setSelectedCust(null)
    setCustQuery('')
    upd({ name: '', phone: '', address: '' })
  }

  React.useEffect(() => { upd({ total: Number(f.hours)*Number(f.cleaners)*Number(f.rate) }) }, [f.hours, f.cleaners, f.rate])

  /* ── Slot availability ── */
  const [slotData, setSlotData] = React.useState({ bookings: [], availableCount: 0, loading: false })

  React.useEffect(() => {
    if (!f.date) return
    setSlotData(p => ({ ...p, loading: true }))
    Promise.all([
      db('bookings').select('time, hours, cleaners, assigned_staff').eq('date', f.date).neq('status', 'Cancelled'),
      db('staff').select('id, working_days'),
    ]).then(([{ data: bks }, { data: staff }]) => {
      const workingStaff = (staff || []).filter(s => isWorkingDay(s, f.date));
      setSlotData({ bookings: bks || [], availableCount: workingStaff.length, workingStaffIds: workingStaff.map(s => s.id), loading: false })
    })
  }, [f.date])

  const parseH = (t) => {
    if (!t || t === '—') return NaN
    const upper = t.toUpperCase()
    const isPM = upper.includes('PM'), isAM = upper.includes('AM')
    const [hStr, mStr] = t.replace(/[^0-9:]/g, '').split(':')
    const h = parseInt(hStr, 10), m = parseInt(mStr, 10) || 0
    if (isNaN(h)) return NaN
    let hour = h
    if (isPM && h !== 12) hour = h + 12
    if (isAM && h === 12) hour = 0
    return hour + m / 60
  }

  // Returns how many working+available maids are free during slot starting at timeStr
  const freeMaidsAt = (timeStr) => {
    const h = parseH(timeStr)
    if (isNaN(h)) return slotData.availableCount
    const busyMaids = new Set()
    let unassigned = 0
    slotData.bookings.forEach(b => {
      const startH = parseH(b.time)
      if (isNaN(startH)) return
      if (startH <= h && h < startH + (b.hours || 1)) {
        if (b.assigned_staff && b.assigned_staff.length > 0) {
          b.assigned_staff.forEach(id => {
            // Only count as busy if they are in the working pool for this date
            if (!slotData.workingStaffIds || slotData.workingStaffIds.includes(id)) busyMaids.add(id);
          });
        } else unassigned += (b.cleaners || 1)
      }
    })
    return Math.max(0, slotData.availableCount - busyMaids.size - unassigned)
  }

  const todayStr = (() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })()
  const isPastSlot = (timeStr) => f.date === todayStr && Math.floor(parseH(timeStr)) <= new Date().getHours()

  const submit = async () => {
    if (!f.name.trim()||!f.phone.trim()) { setErr('Name and phone are required'); return }
    if (isPastSlot(f.time)) { setErr('This time slot is in the past. Please choose a future time.'); return }
    const free = freeMaidsAt(f.time)
    if (slotData.availableCount === 0) { setErr('No staff have this date as a working day. Update working days in Staff Management.'); return }
    if (free < Number(f.cleaners)) { setErr(`Not enough free maids for this slot — only ${free} available (${Number(f.cleaners)} needed). Choose a different time or reduce maid count.`); return }

    // Bulletproof double-booking guard. Pull this date's bookings once; reuse
    // for both the manual-selection check and the auto-assign free-maid filter.
    const dayBookings = await fetchDayBookings(supabase, getScopedCompany(), f.date)

    // Manual selection: block the save if ANY chosen maid already has an
    // overlapping job on this date.
    if (f.manualStaff.length > 0) {
      const newStart = parseTimeToHours(f.time)
      const newEnd   = newStart + (Number(f.hours) || 0)
      for (const sid of f.manualStaff) {
        const conflict = findConflictInRows(dayBookings, sid, newStart, newEnd)
        if (conflict) {
          const nm = (store.staff || []).find(s => s.id === sid)?.name || 'A selected maid'
          setErr(`${nm} is already booked ${conflict.range} (Ref ${conflict.ref}). Choose another maid or time.`)
          return
        }
      }
    }
    setSaving(true); setErr('')

    // Use manually selected maids if provided, otherwise auto-assign
    let assigned_staff = f.manualStaff.length > 0 ? [...f.manualStaff] : []
    if (assigned_staff.length === 0) {
      try {
        const needed = Number(f.cleaners) || 1
        const mode   = 'hourly'
        const { data: availStaff } = await db('staff').select('id, skills, working_days')
        if (availStaff && availStaff.length > 0) {
          let pool = availStaff.filter(s => {
            const sk = Array.isArray(s.skills) ? s.skills : []
            const modes = sk.filter(x => x.startsWith('@')).map(x => x.slice(1))
            return modes.length === 0 || modes.includes(mode)
          })
          if (f.date) pool = pool.filter(s => isWorkingDay(s, f.date))
          const svcId = (store.services || []).find(s => s.name === f.service)?.id
          if (svcId) {
            const skilled = pool.filter(s => {
              const realSkills = (Array.isArray(s.skills) ? s.skills : []).filter(x => !x.startsWith('@'))
              return realSkills.length === 0 || realSkills.includes(svcId) // empty skills = can do all services
            })
            if (skilled.length > 0) pool = skilled
          }
          if (pool.length > 0) {
            const { data: existingBks } = await db('bookings').select('assigned_staff').not('assigned_staff', 'is', null).neq('status', 'Completed').neq('status', 'Cancelled')
            const jobCounts = {}
            ;(existingBks || []).forEach(b => (b.assigned_staff || []).forEach(sid => { jobCounts[sid] = (jobCounts[sid] || 0) + 1 }))
            const sorted = [...pool].sort((a, b) => (jobCounts[a.id] || 0) - (jobCounts[b.id] || 0))
            // Only ever pick maids who are genuinely free during this slot.
            const freeIds = filterFreeMaids(sorted.map(s => s.id), dayBookings, f.time, Number(f.hours))
            assigned_staff = freeIds.slice(0, needed)
          }
        }
      } catch (_) {}
    }

    const row = { ref: await mkRef(), name:f.name, phone:f.phone, service:f.service, date:f.date, time:f.time, hours:Number(f.hours), cleaners:Number(f.cleaners), rate:Number(f.rate), total:Number(f.total), address:f.address, notes:f.notes, status:f.status, materials:false, assigned_staff }
    let { error } = await db('bookings').insert(row)
    // Duplicate ref (deletion gap or concurrent insert) → fall back to a random ref and retry once.
    if (error && (error.code === '23505' || /duplicate key|Bookings_ref_key/i.test(error.message || ''))) {
      const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      row.ref = 'MP-' + Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join('')
      ;({ error } = await db('bookings').insert(row))
    }
    if (error) { setErr(error.message); setSaving(false); return }
    if (!selectedCust && f.name.trim() && f.phone.trim()) {
      const custId = 'c_' + f.phone.replace(/\D/g,'').slice(-10) + '_' + Date.now()
      await db('customers').insert({ id: custId, name: f.name.trim(), phone: f.phone.trim(), address: f.address || '', area: '' }).then(() => {})
    }
    onClose(true)
  }

  const { open: bhOpen = 8, close: bhClose = 19 } = store.businessHours || {}
  const TIMES = HOUR_OPTIONS.filter(o => o.value >= bhOpen && o.value <= bhClose).map(o => o.label)
  const initials = (name) => (name||'?').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50" onClick={() => onClose(false)}/>
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl ring-1 ring-ink-200 p-6 space-y-4 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-mint-500 text-ink-900 grid place-items-center flex-shrink-0"><AdminIcon name="plus" className="w-5 h-5"/></div>
          <div className="flex-1"><div className="font-bold text-ink-900 text-[16px]">New Booking</div><div className="text-[12px] text-ink-500">Create a booking manually</div></div>
          <button onClick={() => onClose(false)} className="w-8 h-8 grid place-items-center rounded-lg text-ink-500 hover:bg-ink-100"><AdminIcon name="x" className="w-4 h-4"/></button>
        </div>

        {err && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-[13px]">{err}</div>}

        {/* ── Customer picker ── */}
        <div>
          <Label className="mb-1.5">Customer</Label>
          <div className="relative" ref={dropRef}>
            <div className="relative">
              <AdminIcon name="contact" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"/>
              <input
                value={custQuery}
                onChange={e => { setCustQuery(e.target.value); setDropOpen(true); if (!e.target.value) clearCustomer() }}
                onFocus={() => setDropOpen(true)}
                placeholder="Search by name or phone, or type to add new…"
                className="w-full h-10 pl-9 pr-8 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"
              />
              {custQuery && (
                <button onClick={clearCustomer} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                  <AdminIcon name="x" className="w-3.5 h-3.5"/>
                </button>
              )}
            </div>

            {/* Selected customer chip */}
            {selectedCust && (
              <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-mint-50 ring-1 ring-mint-300">
                <div className="w-7 h-7 rounded-full bg-mint-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {initials(selectedCust.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-ink-900 truncate">{selectedCust.name}</div>
                  <div className="text-[11.5px] text-ink-500">{selectedCust.phone}</div>
                </div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-mint-700 bg-mint-100 px-2 py-0.5 rounded-full">Existing</span>
              </div>
            )}

            {/* Dropdown */}
            {dropOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl ring-1 ring-ink-200 max-h-52 overflow-y-auto">
                {filteredCusts.length === 0 && !custQuery && (
                  <div className="px-4 py-3 text-[12.5px] text-ink-400">No customers yet. Type a name to add a new one.</div>
                )}
                {filteredCusts.map(c => (
                  <button key={c.id} onMouseDown={() => selectCustomer(c)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-ink-50 text-left transition-colors">
                    <div className="w-7 h-7 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {initials(c.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink-900 truncate">{c.name}</div>
                      <div className="text-[11.5px] text-ink-500">{c.phone || '—'} {c.area ? `· ${c.area}` : ''}</div>
                    </div>
                  </button>
                ))}
                {/* New customer option */}
                <button onMouseDown={selectNew}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-mint-50 text-left border-t border-ink-100 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-mint-100 text-mint-700 flex items-center justify-center flex-shrink-0">
                    <AdminIcon name="plus" className="w-3.5 h-3.5"/>
                  </div>
                  <div className="text-[13px] font-semibold text-mint-700">
                    {custQuery.trim() ? `Add "${custQuery.trim()}" as new customer` : 'Add new customer'}
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Customer detail fields — always shown so admin can edit */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label className="mb-1.5">Name *</Label><TextField value={f.name} onChange={v=>upd({name:v})} placeholder="Full name"/></div>
          <div className="col-span-2"><Label className="mb-1.5">Phone *</Label><TextField value={f.phone} onChange={v=>upd({phone:v})} placeholder="+974 5512 4488"/></div>
          <div className="col-span-2"><Label className="mb-1.5">Service</Label><select value={f.service} onChange={e=>upd({service:e.target.value})} className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none">{svcs.length ? svcs.map(s=><option key={s.id||s.name} value={s.name}>{s.name}{s.on===false ? ' (disabled)' : ''}</option>) : <option value="Regular Cleaning">Regular Cleaning</option>}</select></div>
          <div><Label className="mb-1.5">Date</Label><TextField type="date" value={f.date} onChange={v=>upd({date:v})}/></div>
          <div>
            <Label className="mb-1.5">Time {slotData.loading && <span className="text-ink-400 font-normal normal-case tracking-normal ml-1">checking…</span>}</Label>
            <select value={f.time} onChange={e=>upd({time:e.target.value})} className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none">
              {TIMES.map(t => {
                const past = isPastSlot(t)
                const free = freeMaidsAt(t)
                const full = !past && free < Number(f.cleaners)
                const label = past ? `${t} — Past` : full ? `${t} — Full (${free} free)` : free < slotData.availableCount ? `${t} — ${free} free` : t
                return <option key={t} value={t} disabled={past || full}>{label}</option>
              })}
            </select>
          </div>
          {/* Availability summary for selected date */}
          {!slotData.loading && f.date && (
            <div className={`col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-medium
              ${slotData.availableCount === 0 ? 'bg-red-50 text-red-700' : 'bg-mint-50 text-mint-800'}`}>
              <AdminIcon name={slotData.availableCount === 0 ? 'x' : 'check'} className="w-3.5 h-3.5 flex-shrink-0"/>
              {slotData.availableCount === 0
                ? 'No staff work on this date — update working days in Staff Management.'
                : `${slotData.availableCount} maid${slotData.availableCount !== 1 ? 's' : ''} working on this date. Free at selected time: ${freeMaidsAt(f.time)}.`}
            </div>
          )}
          <div><Label className="mb-1.5">Hours</Label><TextField type="number" value={f.hours} onChange={v=>upd({hours:v})} suffix="hrs"/></div>
          <div>
            <Label className="mb-1.5">Maids</Label>
            <select
              value={f.cleaners}
              onChange={e => { const n = Number(e.target.value); upd({ cleaners: n, manualStaff: f.manualStaff.slice(0, n) }) }}
              className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none"
            >
              {Array.from({ length: Math.max(1, (store.staff||[]).filter(s => s.active !== false).length || 1) }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n} maid{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
          {(store.staff||[]).filter(s => s.active !== false).length > 0 && (
            <div className="col-span-2">
              <Label className="mb-1.5">
                Assign Specific Maids
                <span className="text-ink-400 font-normal normal-case tracking-normal ml-1.5">(optional · select up to {f.cleaners})</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  // Availability per maid for the chosen time + duration on this date.
                  // A maid with an overlapping job is shown as Busy and is unclickable.
                  const ns = parseTimeToHours(f.time)
                  const ne = ns + (Number(f.hours) || 0)
                  return (store.staff||[]).filter(s => s.active !== false).map(s => {
                    const isSelected = f.manualStaff.includes(s.id)
                    const conflict   = isSelected ? null : findConflictInRows(slotData.bookings, s.id, ns, ne)
                    const busy       = !!conflict
                    const isDisabled = busy || (!isSelected && f.manualStaff.length >= Number(f.cleaners))
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={isDisabled}
                        title={busy ? `Busy ${conflict.range}${conflict.ref && conflict.ref !== '—' ? ` (Ref ${conflict.ref})` : ''}` : undefined}
                        onClick={() => {
                          if (isSelected) upd({ manualStaff: f.manualStaff.filter(id => id !== s.id) })
                          else if (!busy && f.manualStaff.length < Number(f.cleaners)) upd({ manualStaff: [...f.manualStaff, s.id] })
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors
                          ${isSelected ? 'border-mint-400 bg-mint-50'
                            : busy ? 'border-amber-200 bg-amber-50/60 cursor-not-allowed'
                            : isDisabled ? 'border-ink-100 bg-ink-50 cursor-not-allowed opacity-50'
                            : 'border-ink-200 bg-white hover:border-mint-300 hover:bg-mint-50'}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold
                          ${isSelected ? 'bg-mint-500 text-white' : busy ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-600'}`}>
                          {isSelected ? <AdminIcon name="check" className="w-3.5 h-3.5"/> : (s.name||'?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-[12.5px] font-medium truncate ${isSelected ? 'text-ink-900' : busy ? 'text-amber-800' : isDisabled ? 'text-ink-400' : 'text-ink-700'}`}>{s.name}</div>
                          {busy && <div className="text-[10.5px] font-semibold text-amber-600 leading-tight truncate">Busy {conflict.range}</div>}
                        </div>
                      </button>
                    )
                  })
                })()}
              </div>
              {f.manualStaff.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-[12px]">
                  <span className="text-mint-700 font-medium">{f.manualStaff.length} of {f.cleaners} maid{Number(f.cleaners) > 1 ? 's' : ''} selected</span>
                  <button type="button" onClick={() => upd({ manualStaff: [] })} className="text-ink-400 hover:text-ink-700 underline">Clear</button>
                </div>
              )}
            </div>
          )}
          <div><Label className="mb-1.5">Rate QAR/hr</Label><TextField type="number" value={f.rate} onChange={v=>upd({rate:v})} suffix="QAR"/></div>
          <div><Label className="mb-1.5">Total</Label><TextField type="number" value={f.total} onChange={v=>upd({total:v})} suffix="QAR"/></div>
          <div className="col-span-2"><Label className="mb-1.5">Status</Label><select value={f.status} onChange={e=>upd({status:e.target.value})} className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none">{BOOKING_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div className="col-span-2"><Label className="mb-1.5">Address</Label><TextField value={f.address} onChange={v=>upd({address:v})} placeholder="Building, street, zone"/></div>
          <div className="col-span-2"><Label className="mb-1.5">Notes</Label><textarea value={f.notes} onChange={e=>upd({notes:e.target.value})} rows={2} placeholder="Special instructions..." className="w-full p-3 rounded-xl bg-white hairline text-[13px] text-ink-900 placeholder:text-ink-400 outline-none resize-none"/></div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-200">
          <GhostBtn onClick={() => onClose(false)}>Cancel</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={saving}><AdminIcon name="plus" className="w-4 h-4"/>{saving ? 'Creating...' : 'Create booking'}</PrimaryBtn>
        </div>
      </div>
    </div>
  )
}
/* ─── Reports Section ─── */
const ReportsSection = ({ bookings, store, reportType = 'daily' }) => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10);
  const todayStr = today.toISOString().slice(0,10);
  const [from, setFrom] = React.useState(firstOfMonth);
  const [to,   setTo]   = React.useState(todayStr);
  const [selectedStaff, setSelectedStaff] = React.useState(null);

  const inRange      = bookings.filter(b => { const d = b._raw?.date || ''; return d >= from && d <= to; });
  const completed    = inRange.filter(b => b.status === 'Completed');
  const nonCancelled = inRange.filter(b => !isCancelledBooking(b));
  const revenue      = nonCancelled.reduce((s, b) => s + (Number(b.total) || 0), 0);
  const paidTotal    = nonCancelled.reduce((s, b) => s + (Number(b.paid_amount) || 0), 0);
  const dueTotal     = nonCancelled.reduce((s, b) => s + Math.max(0, (Number(b.total) || 0) - (Number(b.paid_amount) || 0)), 0);
  const avgVal       = nonCancelled.length > 0 ? revenue / nonCancelled.length : 0;
  const cancelled  = inRange.filter(b => b.status === 'Cancelled').length;
  const pending    = inRange.filter(b => b.status === 'Pending').length;
  const confirmed  = inRange.filter(b => b.status === 'Confirmed').length;
  const cancRate   = inRange.length > 0 ? ((cancelled / inRange.length) * 100).toFixed(1) : '0';

  // Breakdowns
  const byService = {};
  inRange.forEach(b => {
    const svc = b.service || 'Unknown';
    if (!byService[svc]) byService[svc] = { count: 0, revenue: 0 };
    byService[svc].count += 1;
    if (b.status !== 'Cancelled') byService[svc].revenue += (Number(b.total) || 0);
  });
  const byStatus = {};
  inRange.forEach(b => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });

  // Daily revenue trend (capped at 90 days for the chart)
  const dayMs    = 86400000;
  const fromD    = new Date(from + 'T00:00:00');
  const toD      = new Date(to   + 'T00:00:00');
  const totalDays = Math.max(1, Math.round((toD - fromD) / dayMs) + 1);
  const trendDays = Array.from({ length: Math.min(totalDays, 90) }, (_, i) => {
    const d    = new Date(fromD.getTime() + i * dayMs);
    const dStr = d.toISOString().slice(0, 10);
    const lbl  = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const rev  = nonCancelled.filter(b => b._raw?.date === dStr).reduce((s, b) => s + (Number(b.total) || 0), 0);
    const cnt  = inRange.filter(b => b._raw?.date === dStr).length;
    return { date: dStr, label: lbl, revenue: rev, count: cnt };
  });
  const TW = 560, TH = 88;
  const maxRev = Math.max(...trendDays.map(d => d.revenue), 1);
  const tPts = trendDays.map((d, i) => ({
    x: trendDays.length === 1 ? TW / 2 : (i / (trendDays.length - 1)) * TW,
    y: TH - 4 - (d.revenue / maxRev) * (TH - 20),
    ...d,
  }));
  const linePath = tPts.length > 1 ? 'M ' + tPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ') : '';
  const areaPath = tPts.length > 1 ? `${linePath} L ${tPts[tPts.length-1].x},${TH} L ${tPts[0].x},${TH} Z` : '';
  // Pick up to 5 evenly-spaced x-axis labels
  const labelIdxs = trendDays.length <= 7
    ? trendDays.map((_, i) => i)
    : [0, ...Array.from({ length: 3 }, (_, k) => Math.round((k + 1) * (trendDays.length - 1) / 4)), trendDays.length - 1]
        .filter((v, i, a) => a.indexOf(v) === i);

  // Staff performance — match assigned_staff UUIDs to store.staff
  const activeStaff = (store?.staff || []).filter(s => s.active !== false);
  const staffPerf = activeStaff.map(s => {
    const bks = inRange.filter(b => (b._raw?.assigned_staff || []).includes(s.id));
    const rev = bks.filter(b => !isCancelledBooking(b)).reduce((acc, b) => acc + (Number(b.total) || 0), 0);
    return { ...s, bkCount: bks.length, bkRevenue: rev };
  }).sort((a, b) => b.bkCount - a.bkCount);
  const maxBkCount = Math.max(...staffPerf.map(s => s.bkCount), 1);

  // Top customers by booking count
  const custMap = {};
  inRange.forEach(b => {
    const key = (b.phone && b.phone !== '—') ? b.phone : b.customer;
    if (!custMap[key]) custMap[key] = { name: b.customer, phone: b.phone, count: 0, spent: 0 };
    custMap[key].count += 1;
    if (!isCancelledBooking(b)) custMap[key].spent += (Number(b.total) || 0);
  });
  const topCustomers = Object.values(custMap).sort((a, b) => b.count - a.count).slice(0, 8);
  const maxCustCount = Math.max(...topCustomers.map(c => c.count), 1);

  return (
    <div className="space-y-5 fade-up">

      {/* ── Date range ── */}
      <Card title="Date Range" subtitle="All metrics below update with this filter.">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="mb-1.5">From</Label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
          </div>
          <div>
            <Label className="mb-1.5">To</Label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Today',      f: () => { setFrom(todayStr); setTo(todayStr); } },
              { label: 'This week',  f: () => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); setFrom(d.toISOString().slice(0,10)); setTo(todayStr); } },
              { label: 'This month', f: () => { setFrom(firstOfMonth); setTo(todayStr); } },
              { label: 'All time',   f: () => { setFrom('2020-01-01'); setTo(todayStr); } },
            ].map(p => (
              <button key={p.label} onClick={p.f}
                className="h-10 px-3 rounded-lg hairline text-[12.5px] font-semibold text-ink-700 hover:bg-ink-100 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 text-[12.5px] text-ink-500">
          <span className="font-bold text-ink-900">{inRange.length}</span> bookings · <span className="font-mono">{from}</span> → <span className="font-mono">{to}</span>
        </div>
      </Card>

      {reportType === 'daily' && (() => {
        // Resolve assigned staff names for each booking
        const staffList = store?.staff || [];
        const getMaids = (b) => {
          const ids = b._raw?.assigned_staff || [];
          if (!ids.length) return '—';
          return ids.map(id => (staffList.find(s => s.id === id)?.name || '—')).join(', ');
        };

        // Jobs report covers confirmed AND completed jobs (a confirmed job is a
        // real scheduled job that should appear before it's marked complete).
        const completedJobs    = inRange.filter(b => b.status === 'Confirmed' || b.status === 'Completed');
        const totalHours       = completedJobs.reduce((s, b) => s + (b.hours || 0), 0);
        const totalRevenue     = completedJobs.reduce((s, b) => s + (Number(b.total) || 0), 0);
        const totalReceived    = completedJobs.reduce((s, b) => s + (Number(b._raw?.paid_amount) || 0), 0);
        const totalOutstanding = Math.max(0, totalRevenue - totalReceived);

        const handlePrint = () => {
          const brand     = store?.brand || {};
          const brandName = brand.name  || 'Maid Pro';
          const brandPhone= brand.phone || '';
          const brandLogo = brand.logo  || '';
          const printDate = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

          const logoHtml = brandLogo
            ? `<img src="${brandLogo}" alt="${brandName}" style="height:56px;max-width:160px;object-fit:contain;display:block;"/>`
            : `<div style="width:48px;height:48px;border-radius:12px;background:#16a34a;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:900;letter-spacing:-1px;">${brandName.slice(0,1)}</div>`;

          const rows = completedJobs.map((b, i) => `
            <tr class="${i % 2 === 1 ? 'even' : ''}">
              <td class="num">${i + 1}</td>
              <td class="mono" style="font-size:10px;color:#9ca3af">${b.ref || '—'}</td>
              <td class="mono">${b._raw?.date || '—'}</td>
              <td class="mono">${b._raw?.time || b.time || '—'}</td>
              <td>${getMaids(b)}</td>
              <td class="bold">${b.customer || '—'}</td>
              <td class="center">${b.hours ?? '—'}</td>
              <td class="right mono">QAR ${(Number(b.total) || 0).toLocaleString()}</td>
            </tr>`).join('');

          const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>${brandName} — Daily Jobs Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;font-size:12px;color:#1a1a1a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:820px;margin:0 auto;padding:36px 40px}

  /* ── Header bar ── */
  .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:3px solid #16a34a;margin-bottom:28px}
  .brand{display:flex;align-items:center;gap:14px}
  .brand-text{display:flex;flex-direction:column;gap:2px}
  .brand-name{font-size:20px;font-weight:800;color:#111;letter-spacing:-0.5px;line-height:1}
  .brand-phone{font-size:11px;color:#6b7280;margin-top:3px}
  .report-info{text-align:right}
  .report-title{font-size:15px;font-weight:700;color:#111;letter-spacing:-0.3px}
  .report-sub{font-size:11px;color:#6b7280;margin-top:4px;line-height:1.7}

  /* ── Summary pills ── */
  .summary{display:flex;gap:12px;margin-bottom:24px}
  .pill{flex:1;border-radius:10px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0}
  .pill-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#15803d;margin-bottom:4px}
  .pill-value{font-size:18px;font-weight:800;color:#14532d;letter-spacing:-0.5px}
  .pill-unit{font-size:10px;font-weight:500;color:#16a34a;margin-left:3px}

  /* ── Table ── */
  table{width:100%;border-collapse:separate;border-spacing:0;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb}
  thead tr{background:#f9fafb}
  th{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:left;white-space:nowrap}
  td{padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;vertical-align:middle}
  .cancelled-row td{opacity:.5}
  tr.even td{background:#fafafa}
  tbody tr:last-child td{border-bottom:none}
  td.num{color:#9ca3af;font-size:11px;font-weight:500;width:40px}
  td.mono{font-family:monospace;font-size:11.5px;width:110px}
  td.bold{font-weight:600;color:#111}
  td.center{text-align:center;width:70px}
  td.right{text-align:right;width:120px}

  /* ── Footer row ── */
  tfoot td{background:#f0fdf4;padding:12px 14px;font-weight:700;font-size:12.5px;color:#14532d;border-top:2px solid #16a34a}

  /* ── Page footer ── */
  .footer{margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af}

  @media print{
    .page{padding:20px 24px}
    body{font-size:11px}
  }
</style>
</head><body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="brand">
      ${logoHtml}
      <div class="brand-text">
        <div class="brand-name">${brandName}</div>
        ${brandPhone ? `<div class="brand-phone">${brandPhone}</div>` : ''}
      </div>
    </div>
    <div class="report-info">
      <div class="report-title">Daily Jobs Report</div>
      <div class="report-sub">
        Period: ${from} → ${to}<br/>
        Printed: ${printDate}
      </div>
    </div>
  </div>

  <!-- Summary pills -->
  <div class="summary">
    <div class="pill">
      <div class="pill-label">Jobs</div>
      <div class="pill-value">${completedJobs.length}<span class="pill-unit">jobs</span></div>
    </div>
    <div class="pill">
      <div class="pill-label">Total Hours</div>
      <div class="pill-value">${totalHours}<span class="pill-unit">hrs</span></div>
    </div>
    <div class="pill">
      <div class="pill-label">Revenue</div>
      <div class="pill-value">${totalRevenue.toLocaleString()}<span class="pill-unit">QAR</span></div>
    </div>
    <div class="pill">
      <div class="pill-label">Received</div>
      <div class="pill-value">${totalReceived.toLocaleString()}<span class="pill-unit">QAR</span></div>
    </div>
    <div class="pill" style="border-color:${totalOutstanding > 0 ? '#fde68a' : '#bbf7d0'};background:${totalOutstanding > 0 ? '#fffbeb' : '#f0fdf4'}">
      <div class="pill-label" style="color:${totalOutstanding > 0 ? '#92400e' : '#15803d'}">Outstanding</div>
      <div class="pill-value" style="color:${totalOutstanding > 0 ? '#78350f' : '#14532d'}">${totalOutstanding.toLocaleString()}<span class="pill-unit">QAR</span></div>
    </div>
  </div>

  <!-- Jobs table -->
  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th>Ref ID</th>
        <th>Date</th>
        <th>Time</th>
        <th>Maid</th>
        <th>Customer Name</th>
        <th style="text-align:center">Hours</th>
        <th style="text-align:right">Job Total</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:#9ca3af;padding:24px">No jobs in selected range</td></tr>'}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right;letter-spacing:.05em;text-transform:uppercase;font-size:10px">Total</td>
        <td style="text-align:center">${totalHours} hrs</td>
        <td style="text-align:right">QAR ${totalRevenue.toLocaleString()}</td>
        <td style="text-align:right;font-size:10.5px">Rcvd: QAR ${totalReceived.toLocaleString()}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Footer -->
  <div class="footer">
    <span>${brandName} · Daily Jobs Report</span>
    <span>Generated ${printDate}</span>
  </div>

</div>
</body></html>`;

          const w = window.open('', '_blank', 'width=900,height=700');
          if (!w) return;
          w.document.write(html);
          w.document.close();
          w.focus();
          setTimeout(() => { w.print(); }, 300);
        };

        return (
          <Card
            title="Jobs Report — Confirmed & Completed"
            subtitle={`${completedJobs.length} job${completedJobs.length !== 1 ? 's' : ''} · ${from} → ${to}`}
            padded={false}
            action={
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-ink-900 text-white text-[12.5px] font-semibold hover:bg-ink-700 transition-colors">
                <AdminIcon name="print" className="w-3.5 h-3.5"/>
                Print
              </button>
            }>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 bg-ink-50/60 border-b border-ink-200/70">
                    <th className="px-5 py-3 w-12">No.</th>
                    <th className="px-3 py-3 w-28">Ref ID</th>
                    <th className="px-3 py-3 w-28">Date</th>
                    <th className="px-3 py-3 w-28">Time</th>
                    <th className="px-3 py-3">Maid</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3 text-center w-20">Hours</th>
                    <th className="px-5 py-3 text-right w-32">Job Total</th>
                  </tr>
                </thead>
                <tbody>
                  {completedJobs.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-[13px] text-ink-400">No confirmed or completed jobs in selected range.</td></tr>
                  ) : completedJobs.map((b, i) => (
                    <tr key={b.ref} className="border-t border-ink-100 hover:bg-ink-50/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-[12px] text-ink-400 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-3 font-mono text-[12px] text-ink-500">{b.ref || '—'}</td>
                      <td className="px-3 py-3 font-mono text-[12.5px] text-ink-600">{b._raw?.date || '—'}</td>
                      <td className="px-3 py-3 font-mono text-[12.5px] text-ink-600">{b._raw?.time || b.time || '—'}</td>
                      <td className="px-3 py-3 text-[13px] text-ink-700">{getMaids(b)}</td>
                      <td className="px-3 py-3 text-[13px] font-semibold text-ink-900">{b.customer}</td>
                      <td className="px-3 py-3 text-center font-mono tabular-nums text-[13px] text-ink-700">{b.hours ?? '—'}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-[13px] font-semibold text-ink-900">
                        QAR {(Number(b.total) || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {completedJobs.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-ink-200 bg-ink-50/60">
                      <td colSpan={5} className="px-5 py-3 text-right text-[12px] font-bold text-ink-600 uppercase tracking-wider">Total</td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-[13px] text-ink-900 tabular-nums">{totalHours}</td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-[13px] text-ink-900 tabular-nums">
                        <div>QAR {totalRevenue.toLocaleString()}</div>
                        <div className="text-[11px] font-semibold text-mint-700 mt-0.5">Rcvd {totalReceived.toLocaleString()}</div>
                        {totalOutstanding > 0 && <div className="text-[11px] font-semibold text-amber-600 mt-0.5">Due {totalOutstanding.toLocaleString()}</div>}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        );
      })()}

      {reportType === 'staff' && (() => {
        // Show ALL staff in the report, including on-hold ones. Deleted staff are
        // already removed from store.staff, so they stay excluded automatically.
        const allStaff = (store?.staff || []);

        // Per-staff bookings in range — completed jobs only
        const staffBookings = (s) =>
          inRange.filter(b =>
            (b._raw?.assigned_staff || []).includes(s.id) &&
            b.status === 'Completed'
          );

        // Parse "9:00 AM" → 9, "2:30 PM" → 14.5
        const parseHour = (t) => {
          if (!t || t === '—') return NaN;
          const [timePart, ampm] = t.trim().split(' ');
          const [hStr, mStr] = timePart.split(':');
          let h = parseInt(hStr, 10);
          const m = parseInt(mStr || '0', 10);
          if (ampm === 'PM' && h !== 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          return h + m / 60;
        };

        const fmtFinish = (b) => {
          const t = b._raw?.time || b.time || '';
          const h = parseHour(t);
          const hrs = Number(b.hours) || 0;
          if (isNaN(h) || !hrs) return '—';
          const finish = h + hrs;
          const fh = Math.floor(finish) % 24;
          const fm = Math.round((finish % 1) * 60);
          const ampm = fh >= 12 ? 'PM' : 'AM';
          const disp = fh % 12 === 0 ? 12 : fh % 12;
          return `${disp}:${String(fm).padStart(2,'0')} ${ampm}`;
        };

        const COLORS = ['#16a34a','#2563eb','#9333ea','#ea580c','#0891b2','#db2777','#ca8a04','#65a30d'];

        const selected = selectedStaff ? allStaff.find(s => s.id === selectedStaff) : null;
        const selectedBks = selected ? staffBookings(selected) : [];

        const totalHoursStaff    = selectedBks.reduce((s, b) => s + (Number(b.hours) || 0), 0);
        const totalRevenueStaff  = selectedBks.reduce((s, b) => s + (Number(b.total) || 0), 0);
        const totalReceivedStaff = selectedBks.reduce((s, b) => s + (Number(b._raw?.paid_amount) || 0), 0);
        const totalDueStaff      = Math.max(0, totalRevenueStaff - totalReceivedStaff);

        const handlePrintStaff = () => {
          if (!selected) return;
          const brand      = store?.brand || {};
          const brandName  = brand.name  || 'Maid Pro';
          const brandPhone = brand.phone || '';
          const brandLogo  = brand.logo  || '';
          const printDate  = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

          const logoHtml = brandLogo
            ? `<img src="${brandLogo}" alt="${brandName}" style="height:56px;max-width:160px;object-fit:contain;display:block;"/>`
            : `<div style="width:48px;height:48px;border-radius:12px;background:#16a34a;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:900;">${brandName.slice(0,1)}</div>`;

          const rows = selectedBks.map((b, i) => `
            <tr class="${i % 2 === 1 ? 'even' : ''}">
              <td class="num">${i + 1}</td>
              <td class="mono">${b._raw?.date || '—'}</td>
              <td class="mono">${b._raw?.time || b.time || '—'}</td>
              <td class="mono">${fmtFinish(b)}</td>
              <td class="bold">${b.customer || '—'}</td>
              <td class="center">${b.hours ?? '—'}</td>
              <td class="right mono">QAR ${(Number(b.total) || 0).toLocaleString()}</td>
            </tr>`).join('');

          const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>${selected.name} — Staff Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;font-size:12px;color:#1a1a1a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:860px;margin:0 auto;padding:36px 40px}
  .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:3px solid #16a34a;margin-bottom:28px}
  .brand{display:flex;align-items:center;gap:14px}
  .brand-name{font-size:20px;font-weight:800;color:#111;letter-spacing:-0.5px;line-height:1}
  .brand-phone{font-size:11px;color:#6b7280;margin-top:3px}
  .report-info{text-align:right}
  .report-title{font-size:15px;font-weight:700;color:#111}
  .report-sub{font-size:11px;color:#6b7280;margin-top:4px;line-height:1.7}
  .staff-badge{display:inline-flex;align-items:center;gap:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 16px;margin-bottom:24px}
  .staff-avatar{width:36px;height:36px;border-radius:50%;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;flex-shrink:0}
  .staff-name{font-size:14px;font-weight:700;color:#14532d}
  .summary{display:flex;gap:12px;margin-bottom:24px}
  .pill{flex:1;border-radius:10px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0}
  .pill-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#15803d;margin-bottom:4px}
  .pill-value{font-size:18px;font-weight:800;color:#14532d}
  .pill-unit{font-size:10px;font-weight:500;color:#16a34a;margin-left:3px}
  table{width:100%;border-collapse:separate;border-spacing:0;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb}
  thead tr{background:#f9fafb}
  th{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:left;white-space:nowrap}
  td{padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;vertical-align:middle}
  tr.even td{background:#fafafa}
  tbody tr:last-child td{border-bottom:none}
  td.num{color:#9ca3af;font-size:11px;width:40px}
  td.mono{font-family:monospace;font-size:11.5px}
  td.bold{font-weight:600;color:#111}
  td.center{text-align:center;width:70px}
  td.right{text-align:right;width:120px}
  tfoot td{background:#f0fdf4;padding:12px 14px;font-weight:700;font-size:12.5px;color:#14532d;border-top:2px solid #16a34a}
  .footer{margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af}
  @media print{.page{padding:20px 24px}}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="brand">
      ${logoHtml}
      <div>
        <div class="brand-name">${brandName}</div>
        ${brandPhone ? `<div class="brand-phone">${brandPhone}</div>` : ''}
      </div>
    </div>
    <div class="report-info">
      <div class="report-title">Staff Performance Report</div>
      <div class="report-sub">Period: ${from} → ${to}<br/>Printed: ${printDate}</div>
    </div>
  </div>
  <div class="staff-badge">
    <div class="staff-avatar">${selected.name.slice(0,1).toUpperCase()}</div>
    <div class="staff-name">${selected.name}</div>
  </div>
  <div class="summary">
    <div class="pill"><div class="pill-label">Total Jobs</div><div class="pill-value">${selectedBks.length}<span class="pill-unit">jobs</span></div></div>
    <div class="pill"><div class="pill-label">Total Hours</div><div class="pill-value">${totalHoursStaff}<span class="pill-unit">hrs</span></div></div>
    <div class="pill"><div class="pill-label">Revenue</div><div class="pill-value">${totalRevenueStaff.toLocaleString()}<span class="pill-unit">QAR</span></div></div>
    <div class="pill"><div class="pill-label">Received</div><div class="pill-value">${totalReceivedStaff.toLocaleString()}<span class="pill-unit">QAR</span></div></div>
    <div class="pill" style="border-color:${totalDueStaff > 0 ? '#fde68a' : '#bbf7d0'};background:${totalDueStaff > 0 ? '#fffbeb' : '#f0fdf4'}"><div class="pill-label" style="color:${totalDueStaff > 0 ? '#92400e' : '#15803d'}">Outstanding</div><div class="pill-value" style="color:${totalDueStaff > 0 ? '#78350f' : '#14532d'}">${totalDueStaff.toLocaleString()}<span class="pill-unit">QAR</span></div></div>
  </div>
  <table>
    <thead><tr>
      <th>No.</th><th>Date</th><th>Start Time</th><th>Finish Time</th><th>Customer</th>
      <th style="text-align:center">Hours</th><th style="text-align:right">Job Total</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:24px">No jobs in selected range</td></tr>'}</tbody>
    <tfoot><tr>
      <td colspan="5" style="text-align:right;text-transform:uppercase;font-size:10px;letter-spacing:.05em">Total</td>
      <td style="text-align:center">${totalHoursStaff} hrs</td>
      <td style="text-align:right">QAR ${totalRevenueStaff.toLocaleString()}<br/><span style="font-size:10px;font-weight:500">Rcvd: QAR ${totalReceivedStaff.toLocaleString()}</span>${totalDueStaff > 0 ? `<br/><span style="font-size:10px;font-weight:500;color:#92400e">Due: QAR ${totalDueStaff.toLocaleString()}</span>` : ''}</td>
    </tr></tfoot>
  </table>
  <div class="footer"><span>${brandName} · Staff Report · ${selected.name}</span><span>Generated ${printDate}</span></div>
</div></body></html>`;

          const w = window.open('', '_blank', 'width=920,height=720');
          if (!w) return;
          w.document.write(html);
          w.document.close();
          w.focus();
          setTimeout(() => { w.print(); }, 300);
        };

        return (
          <div className="space-y-5 fade-up">

            {/* Staff grid */}
            <Card title="Select Staff Member" subtitle="Click a card to view their job report for the selected date range.">
              {allStaff.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-ink-400">No staff found.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-1">
                  {allStaff.map((s, idx) => {
                    const bks  = staffBookings(s);
                    const rev  = bks.reduce((a, b) => a + (Number(b.total) || 0), 0);
                    const rcvd = bks.reduce((a, b) => a + (Number(b._raw?.paid_amount) || 0), 0);
                    const hrs  = bks.reduce((a, b) => a + (Number(b.hours) || 0), 0);
                    const col  = COLORS[idx % COLORS.length];
                    const isSel = selectedStaff === s.id;
                    return (
                      <button key={s.id} onClick={() => setSelectedStaff(isSel ? null : s.id)}
                        className={`text-left rounded-2xl p-4 border-2 transition-all ${isSel ? 'border-[#16a34a] bg-[#f0fdf4] shadow-md' : 'border-ink-200 bg-white hover:border-ink-300 hover:shadow-sm'}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0"
                            style={{ background: col }}>
                            {s.name.slice(0,1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <div className="font-semibold text-[13.5px] text-ink-900 truncate">{s.name}</div>
                              {s.active === false && (
                                <span className="flex-shrink-0 h-4 px-1.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wide flex items-center">On Hold</span>
                              )}
                            </div>
                            <div className="text-[11px] text-ink-400 mt-0.5">{bks.length} job{bks.length !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className="flex justify-between text-[11.5px]">
                          <span className="text-ink-500">{hrs} hrs</span>
                          <div className="text-right">
                            <div className="font-semibold text-ink-700">QAR {rev.toLocaleString()}</div>
                            <div className="text-[10px] text-mint-700">Rcvd {rcvd.toLocaleString()}</div>
                          </div>
                        </div>
                        {isSel && (
                          <div className="mt-2 text-[10.5px] font-semibold text-[#16a34a] uppercase tracking-wide">Selected ✓</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Detailed table for selected staff */}
            {selected && (
              <Card
                title={`Jobs — ${selected.name}`}
                subtitle={`${selectedBks.length} job${selectedBks.length !== 1 ? 's' : ''} · ${from} → ${to}`}
                action={
                  <button onClick={handlePrintStaff}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg hairline text-[12px] font-semibold text-ink-700 hover:bg-ink-100 transition-colors">
                    <AdminIcon name="print" className="w-4 h-4"/><span>Print</span>
                  </button>
                }>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 bg-ink-50/60 border-b border-ink-200/70">
                        <th className="px-5 py-3 w-10">No.</th>
                        <th className="px-3 py-3 w-28">Date</th>
                        <th className="px-3 py-3 w-28">Start Time</th>
                        <th className="px-3 py-3 w-28">Finish Time</th>
                        <th className="px-3 py-3">Customer</th>
                        <th className="px-3 py-3 text-center w-20">Hours</th>
                        <th className="px-5 py-3 text-right w-36">Job Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBks.length === 0 ? (
                        <tr><td colSpan={7} className="px-5 py-12 text-center text-[13px] text-ink-400">No jobs in selected range.</td></tr>
                      ) : selectedBks.map((b, i) => (
                        <tr key={b.ref || i} className="border-t border-ink-100 hover:bg-ink-50/50 transition-colors">
                          <td className="px-5 py-3 font-mono text-[12px] text-ink-400">{i + 1}</td>
                          <td className="px-3 py-3 font-mono text-[12.5px] text-ink-600">{b._raw?.date || '—'}</td>
                          <td className="px-3 py-3 font-mono text-[12.5px] text-ink-600">{b._raw?.time || b.time || '—'}</td>
                          <td className="px-3 py-3 font-mono text-[12.5px] text-ink-600">{fmtFinish(b)}</td>
                          <td className="px-3 py-3 text-[13px] font-semibold text-ink-900">{b.customer || '—'}</td>
                          <td className="px-3 py-3 text-center font-mono text-[13px] text-ink-700">{b.hours ?? '—'}</td>
                          <td className="px-5 py-3 text-right font-mono font-semibold text-[13px] text-ink-900">
                            QAR {(Number(b.total) || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {selectedBks.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-ink-200 bg-ink-50/60">
                          <td colSpan={5} className="px-5 py-3 text-right text-[12px] font-bold text-ink-600 uppercase tracking-wider">Total</td>
                          <td className="px-3 py-3 text-center font-mono font-bold text-[13px] text-ink-900">{totalHoursStaff}</td>
                          <td className="px-5 py-3 text-right font-mono font-bold text-[13px] text-ink-900">
                            <div>QAR {totalRevenueStaff.toLocaleString()}</div>
                            <div className="text-[11px] font-semibold text-mint-700 mt-0.5">Rcvd {totalReceivedStaff.toLocaleString()}</div>
                            {totalDueStaff > 0 && <div className="text-[11px] font-semibold text-amber-600 mt-0.5">Due {totalDueStaff.toLocaleString()}</div>}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </Card>
            )}

          </div>
        );
      })()}
    </div>
  );
};

/* ─── Admin Login ─── */
const LoginScreen = ({ onResetActive }) => {
  const [email, setEmail]             = React.useState('');
  const [pass, setPass]               = React.useState('');
  const [err, setErr]                 = React.useState('');
  const [loading, setLoading]         = React.useState(false);
  const [forgotStep, setForgotStep]   = React.useState(null); // null | 'email' | 'code' | 'password'
  const [code, setCode]               = React.useState('');
  const [newPass, setNewPass]         = React.useState('');
  const [confirmPass, setConfirmPass] = React.useState('');
  const [success, setSuccess]         = React.useState(false);
  const [cooldown, setCooldown]       = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const cancelForgot = () => {
    setForgotStep(null); setCode(''); setNewPass(''); setConfirmPass('');
    setErr(''); setSuccess(false); setCooldown(0);
    onResetActive(false);
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setLoading(false);
    if (error) setErr(error.message || 'Invalid email or password.');
  };

  const sendOtp = async (e) => {
    if (e) e.preventDefault();
    setErr('');
    setLoading(true);
    // Ignore error — never reveal whether the email exists
    await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    setLoading(false);
    setCooldown(30);
    setForgotStep('code');
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setErr('');
    if (code.trim().length < 6) { setErr('Please enter the full code from your email.'); return; }
    setLoading(true);
    // Set resetMode BEFORE the await so App doesn't auto-navigate when session is established
    onResetActive(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setLoading(false);
    if (error) {
      onResetActive(false);
      setErr('Invalid or expired code. Request a new one.');
      return;
    }
    setForgotStep('password');
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    setErr('');
    if (newPass.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (newPass !== confirmPass) { setErr('Passwords do not match.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setLoading(false);
    if (error) { setErr(error.message || 'Failed to set password. Try again.'); return; }
    setSuccess(true);
    // Session is already active — releasing resetMode lets App show AdminPanel
    setTimeout(() => onResetActive(false), 1600);
  };

  const ic = "w-full h-11 pl-9 pr-3 rounded-xl bg-white hairline text-[14px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]";
  const bp = "w-full h-11 rounded-xl bg-mint-500 hover:bg-mint-400 active:bg-mint-600 disabled:opacity-60 text-ink-900 font-bold text-[14px] shadow-mint transition-colors";
  const bs = "w-full h-10 rounded-xl border border-ink-200 text-[13.5px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors";

  const Logo = () => (
    <div className="text-center">
      <div className="w-14 h-14 rounded-2xl bg-mint-500 grid place-items-center mx-auto shadow-mint mb-4">
        <AdminIcon name="sparkle" className="w-7 h-7 text-ink-900" strokeWidth={2.2}/>
      </div>
      <h1 className="text-[22px] font-extrabold text-ink-900 tracking-tight">Maid Pro Admin</h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-float p-8 space-y-6">

        {/* ── Normal login ── */}
        {forgotStep === null && (
          <>
            <div className="text-center"><Logo /><p className="text-[13px] text-ink-500 mt-1">Sign in to your admin panel</p></div>
            <form onSubmit={submitLogin} className="space-y-3">
              <div>
                <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Email</label>
                <div className="relative">
                  <AdminIcon name="contact" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"/>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" autoComplete="email" className={ic}/>
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Password</label>
                <div className="relative">
                  <AdminIcon name="settings" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"/>
                  <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" autoComplete="current-password" className={ic}/>
                </div>
              </div>
              {err && <div className="text-[12.5px] text-red-600 font-medium">{err}</div>}
              <button type="submit" disabled={loading} className={bp + ' mt-1'}>{loading ? 'Signing in…' : 'Sign in'}</button>
              <div className="text-center pt-1">
                <button type="button" onClick={() => { setForgotStep('email'); setErr(''); }}
                  className="text-[13px] text-ink-500 hover:text-ink-800 underline underline-offset-2 transition-colors">
                  Forgot password?
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Step 1: enter email ── */}
        {forgotStep === 'email' && (
          <>
            <Logo />
            <form onSubmit={sendOtp} className="space-y-3">
              <p className="text-[13px] text-ink-500 -mt-2">Enter your email and we'll send a 6-digit code.</p>
              <div>
                <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Email</label>
                <div className="relative">
                  <AdminIcon name="contact" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"/>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" autoComplete="email" required className={ic}/>
                </div>
              </div>
              {err && <div className="text-[12.5px] text-red-600 font-medium">{err}</div>}
              <button type="submit" disabled={loading} className={bp}>{loading ? 'Sending…' : 'Send code'}</button>
              <button type="button" onClick={cancelForgot} className={bs}>Back to sign in</button>
            </form>
          </>
        )}

        {/* ── Step 2: enter 6-digit code ── */}
        {forgotStep === 'code' && (
          <>
            <Logo />
            <form onSubmit={submitCode} className="space-y-3">
              <p className="text-[13px] text-ink-500 -mt-2">
                Enter the code sent to <strong className="text-ink-800">{email}</strong>.
              </p>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••••" autoComplete="one-time-code"
                className="w-full h-14 px-4 rounded-xl bg-white hairline text-[28px] font-mono tracking-[0.4em] text-ink-900 text-center outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
              {err && <div className="text-[12.5px] text-red-600 font-medium">{err}</div>}
              <button type="submit" disabled={loading} className={bp}>{loading ? 'Verifying…' : 'Verify code'}</button>
              <div className="flex items-center justify-between text-[13px] pt-0.5">
                <button type="button" onClick={cancelForgot} className="text-ink-500 hover:text-ink-800 transition-colors">Cancel</button>
                {cooldown > 0
                  ? <span className="text-ink-400">Resend in {cooldown}s</span>
                  : <button type="button" onClick={sendOtp} disabled={loading} className="text-mint-700 hover:text-mint-900 font-semibold transition-colors">Resend code</button>
                }
              </div>
            </form>
          </>
        )}

        {/* ── Step 3: set new password ── */}
        {forgotStep === 'password' && (
          <>
            <Logo />
            {success ? (
              <div className="rounded-xl bg-mint-50 border border-mint-200 px-4 py-4 text-[13.5px] text-mint-900 text-center leading-relaxed">
                Password updated! Taking you to the admin panel…
              </div>
            ) : (
              <form onSubmit={submitNewPassword} className="space-y-3">
                <p className="text-[13px] text-ink-500 -mt-2">Code verified. Choose a new password.</p>
                <div>
                  <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">New password</label>
                  <div className="relative">
                    <AdminIcon name="settings" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"/>
                    <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="••••••••" autoComplete="new-password" required className={ic}/>
                  </div>
                </div>
                <div>
                  <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Confirm password</label>
                  <div className="relative">
                    <AdminIcon name="settings" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"/>
                    <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="••••••••" autoComplete="new-password" required className={ic}/>
                  </div>
                </div>
                {err && <div className="text-[12.5px] text-red-600 font-medium">{err}</div>}
                <button type="submit" disabled={loading} className={bp + ' mt-1'}>{loading ? 'Updating…' : 'Update password'}</button>
              </form>
            )}
          </>
        )}

      </div>
    </div>
  );
};

const AdminPanel = ({ companyId, companySlug }) => {
  const [section, setSection] = React.useState("overview");
  const [payFilter, setPayFilter] = React.useState("All");
  const [store, setStore] = React.useState(initialStore());
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [globalSearch, setGlobalSearch] = React.useState('');
  const [dbStatus, setDbStatus] = React.useState('checking'); // 'checking' | 'ok' | 'error'
  const [dbError, setDbError] = React.useState('');
  // Translate the admin UI into the brand's chosen language (see admin-i18n.js)
  const adminLang = store.brand?.language || 'en';
  const adminRootRef = React.useRef(null);
  useAdminI18n(adminLang, () => adminRootRef.current);
  // Ref so the realtime handler always reads the latest setting without stale closure
  const notifSoundRef = React.useRef(true);
  React.useEffect(() => {
    notifSoundRef.current = store.bookingRules?.bookingSound !== false;
  }, [store.bookingRules?.bookingSound]);

  const set = (p) => setStore(prev => { const patch = typeof p === 'function' ? p(prev) : p; return { ...prev, ...patch }; });

  /* Connection health-check — runs once on mount and on manual retry */
  const checkConnection = React.useCallback(async () => {
    setDbStatus('checking');
    try {
      const { error } = await db('settings').select('key').limit(1);
      if (error) {
        setDbStatus('error');
        setDbError(error.message);
      } else {
        setDbStatus('ok');
        setDbError('');
      }
    } catch (e) {
      setDbStatus('error');
      setDbError(e.message || 'Network error');
    }
  }, []);

  React.useEffect(() => { checkConnection(); }, [checkConnection]);
  const clearAll = async () => {
    /* Step 1 — fetch every row id so we can delete by primary key */
    const { data: rows, error: fetchErr } = await db('bookings').select('id');
    if (fetchErr) { alert('Could not read bookings: ' + fetchErr.message); return; }

    if (rows && rows.length > 0) {
      const ids = rows.map(r => r.id);
      const { error: delErr } = await db('bookings').delete().in('id', ids);
      if (delErr) { alert('Delete failed: ' + delErr.message); return; }
    }

    /* Step 2 — verify Supabase actually removed the rows */
    const { count } = await db('bookings').select('*', { count: 'exact', head: true });
    if (count && count > 0) {
      alert(
        `${count} booking(s) could not be deleted.\n\n` +
        `Fix in Supabase Dashboard:\n` +
        `Table Editor → bookings → RLS Policies → Add Policy\n` +
        `Operation: DELETE   Using expression: true`
      );
      return;
    }

    /* Also clear customers */
    const { data: custRows } = await db('customers').select('id');
    if (custRows && custRows.length > 0) {
      await db('customers').delete().in('id', custRows.map(r => r.id));
    }

    setBookings([]);
    // Only reset booking-related store state — preserve staff, settings, services, nationalities, etc.
    setStore(prev => ({ ...prev, assignments: {}, staffHours: {} }));
  };

  React.useEffect(() => {
    (async () => {
      const { data, error } = await db('settings').select('*');
      if (error) { console.error('Failed to load settings:', error.message); setDbStatus('error'); setDbError(error.message); return; }
      if (!data || !data.length) { console.log('Settings table empty — using defaults'); return; }
      // Check if the table uses the correct schema (key/value columns, not id/data)
      if (data[0] && !('key' in data[0])) {
        console.error('Settings table uses old schema (id/data). Run supabase-setup-v2.sql to migrate.');
        setDbStatus('error');
        setDbError('Settings table has wrong columns. Run supabase-setup-v2.sql in your Supabase SQL Editor.');
        return;
      }
      setDbStatus('ok');
      const m = Object.fromEntries(data.map(r => [r.key, r.value]));
      const p = {};
      if (m.services)        p.services        = m.services;
      if (m.fixedServices)   p.fixedServices   = m.fixedServices;
      if (m.limits)          p.limits          = m.limits;
      if (m.modes) {
        // Fix garbled emojis stored from old encoding — always use canonical emojis
        const EMOJI_MAP = { hourly: '⏱️', monthly: '📅', stayin: '🏠' };
        p.modes = m.modes.map(x => ({ ...x, emoji: EMOJI_MAP[x.id] || x.emoji }));
      }
      if (m.monthly)         p.monthly         = m.monthly;
      if (m.monthlySettings) p.monthlySettings = m.monthlySettings;
      if (m.stayIn)          p.stayIn          = m.stayIn;
      if (m.stayinSettings)  p.stayinSettings  = m.stayinSettings;
      if (m.materials)       { p.materialsRate=m.materials.rate; p.materialsEnabled=m.materials.enabled; p.materialsList=m.materials.items; }
      if (m.brand)           p.brand           = m.brand;
      if (m.bookingRules)    p.bookingRules    = m.bookingRules;
      if (m.businessHours)   p.businessHours   = m.businessHours;
      if (m.nationalities_block) p.nationalitiesEnabled = m.nationalities_block.enabled !== false;
      console.log('Settings loaded from Supabase — keys:', Object.keys(p).join(', '));
      if (Object.keys(p).length) setStore(prev => ({ ...prev, ...p }));
    })();
  }, [])

  /* Live bookings from Supabase */
  const [bookings, setBookings] = React.useState([]);
  const [bLoading, setBLoading] = React.useState(true);
  // Track known booking IDs so any fetch path (realtime or poll) can detect new arrivals
  const knownBookingIds = React.useRef(null); // null = first load, don't chime

  const fetchBookings = React.useCallback(async () => {
    const { data, error } = await db('bookings').select('*').order('created_at', { ascending: false }).limit(500);
    if (!error && data) {
      // Detect genuinely new bookings (skip on first load)
      if (knownBookingIds.current !== null) {
        const newOnes = data.filter(b => !knownBookingIds.current.has(b.id));
        if (newOnes.length > 0 && notifSoundRef.current) playBookingChime();
      }
      knownBookingIds.current = new Set(data.map(b => b.id));
      setBookings(data.map(fmtBooking));
      // Sync assigned_staff and staff_hours from DB into store
      const assignMap = {};
      const hoursMap  = {};
      data.forEach(b => {
        const ref = b.ref || String(b.id);
        if (Array.isArray(b.assigned_staff) && b.assigned_staff.length > 0)
          assignMap[ref] = b.assigned_staff;
        if (b.staff_hours && typeof b.staff_hours === 'object' && Object.keys(b.staff_hours).length > 0)
          hoursMap[ref] = b.staff_hours;
      });
      setStore(prev => ({
        ...prev,
        assignments: { ...(prev.assignments || {}), ...assignMap },
        staffHours:  { ...(prev.staffHours  || {}), ...hoursMap  },
      }));
    }
    setBLoading(false);
  }, []);

  /* Auto-assign: query Supabase directly so we never read stale React state */
  const handleAutoAssign = React.useCallback(async (newRow) => {
    if (!newRow?.id) return;

    // Check if autoAssign is enabled in settings (read from DB, not local state)
    const { data: settingsRows } = await db('settings').select('key,value').eq('key', 'bookingRules').maybeSingle();
    const autoAssign = settingsRows?.value?.autoAssign ?? true; // default true if not saved yet
    if (!autoAssign) return;

    // Skip if this booking is already assigned
    const { data: bkRow } = await db('bookings').select('assigned_staff').eq('id', newRow.id).maybeSingle();
    if (bkRow?.assigned_staff?.length > 0) return;

    // Get all staff — exclude on-hold, then filter by working_days and mode
    let staffRes = await db('staff').select('id, skills, working_days, active');
    let availableStaff = staffRes.data;
    if (staffRes.error || !availableStaff) {
      const fb = await db('staff').select('id, skills');
      availableStaff = (fb.data || []).map(s => ({ ...s, working_days: null, active: true }));
    }
    if (!availableStaff || availableStaff.length === 0) return;

    // Filter by booking mode (look for @mode prefix in skills array)
    const mode = newRow.mode || 'hourly';
    let pool = availableStaff.filter(s => s.active !== false).filter(s => {
      const sk = Array.isArray(s.skills) ? s.skills : [];
      const modes = sk.filter(x => x.startsWith('@')).map(x => x.slice(1));
      return modes.length === 0 || modes.includes(mode);
    });

    // Filter by working day for the booking date
    if (newRow.date) {
      const bookingDow = new Date(newRow.date + 'T00:00:00').getDay();
      pool = pool.filter(s => isWorkingDay(s, newRow.date));
    }

    // For hourly: also filter by skill (look up service name → skill ID from settings)
    if (mode === 'hourly' && newRow.service) {
      const { data: svcSettings } = await db('settings').select('value').eq('key','services').maybeSingle();
      const svcId = (svcSettings?.value || []).find(s => s.name === newRow.service)?.id;
      if (svcId) {
        const skilled = pool.filter(s => {
          const realSkills = (Array.isArray(s.skills) ? s.skills : []).filter(x => !x.startsWith('@'));
          return realSkills.length === 0 || realSkills.includes(svcId); // empty skills = can do all services
        });
        if (skilled.length > 0) pool = skilled;
      }
    }

    if (pool.length === 0) return;

    // Count only active (non-completed, non-cancelled) jobs per maid so historical load doesn't skew distribution
    const { data: allBookings } = await db('bookings').select('assigned_staff').not('assigned_staff', 'is', null).neq('status', 'Completed').neq('status', 'Cancelled');
    const jobCounts = {};
    (allBookings || []).forEach(b => (b.assigned_staff || []).forEach(sid => { jobCounts[sid] = (jobCounts[sid] || 0) + 1; }));

    // Pick the N least-busy maids — but only from those genuinely FREE during
    // this booking's time window (never double-book an overlapping slot).
    const needed = Math.max(1, Number(newRow.cleaners) || 1);
    const sorted = [...pool].sort((a, b) => (jobCounts[a.id] || 0) - (jobCounts[b.id] || 0));
    const dayBookings = await fetchDayBookings(supabase, getScopedCompany(), newRow.date);
    const freeIds = filterFreeMaids(
      sorted.map(s => s.id), dayBookings, newRow.time, Number(newRow.hours), newRow.id
    );
    const assigned = freeIds.slice(0, needed);
    const ref = newRow.ref || String(newRow.id);

    await db('bookings').update({ assigned_staff: assigned }).eq('id', newRow.id);
    setStore(prev => ({ ...prev, assignments: { ...(prev.assignments || {}), [ref]: assigned } }));
    fetchBookings();
  }, [fetchBookings]);

  React.useEffect(() => {
    fetchBookings();

    // Realtime — instant when Supabase Realtime is enabled for the bookings table
    const ch = supabase.channel('admin-bookings-live-' + companyId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        fetchBookings(); // chime is handled inside fetchBookings via knownBookingIds
        if (payload.eventType === 'INSERT') handleAutoAssign(payload.new);
      })
      .subscribe();

    // Polling fallback — catches new bookings every 5 s if realtime isn't enabled
    const poll = setInterval(fetchBookings, 5000);

    window.addEventListener('refreshBookings', fetchBookings);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
      window.removeEventListener('refreshBookings', fetchBookings);
    };
  }, [fetchBookings, handleAutoAssign]);

  /* ── Live nationalities from Supabase ── */
  const fetchNationalities = React.useCallback(async () => {
    const { data, error } = await db('nationalities').select('*').order('name');
    if (!error && data) {
      setStore(prev => ({ ...prev, nationalities: data.map(n => ({
        id: n.id, name: n.name, flag: toFlag(n.flag || '🌍'),
        rate: Number(n.rate) || 15, on: n.enabled !== false,
      })) }));
    }
  }, []);

  /* ── Live staff from Supabase ── */
  const fetchStaff = React.useCallback(async () => {
    const { data, error } = await db('staff').select('*').order('name');
    if (!error && data && data.length > 0) {
      setStore(prev => ({ ...prev, staff: data.map(s => ({
        id: s.id, name: s.name || '',
        nationality: s.nationality || 'philippines',
        color: s.color || 'mint',
        // Service modes are stored as "@hourly","@monthly","@stayin" inside the skills array
        skills:        (Array.isArray(s.skills) ? s.skills : []).filter(sk => !sk.startsWith('@')),
        serviceTypes:  (Array.isArray(s.skills) ? s.skills : []).filter(sk => sk.startsWith('@')).map(sk => sk.slice(1)),
        phone: s.phone || '',
        notes: s.notes || '',
        working_days: Array.isArray(s.working_days) ? s.working_days : [0,1,2,3,4,5,6],
        active: s.active !== false,
      })) }));
    }
  }, []);

  React.useEffect(() => {
    fetchNationalities();
    fetchStaff();
    const ch2 = supabase
      .channel('admin-nat-staff-live-' + companyId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nationalities' }, fetchNationalities)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, fetchStaff)
      .subscribe();
    return () => supabase.removeChannel(ch2);
  }, [fetchNationalities, fetchStaff]);

  // Local calendar date (YYYY-MM-DD) — use the admin's own timezone, not UTC, so
  // "today" doesn't drift to the wrong day near midnight (e.g. GMT+3 Qatar).
  const _now = new Date();
  const todayISO  = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  // bookingDateKey() normalises both ISO ("2026-06-24") and formatted dates, so the
  // match works regardless of how the row's date is stored. These three KPIs below
  // (Bookings Today / Today Revenue / Today Received) count ONLY today's bookings.
  const todayBks  = bookings.filter(b => bookingDateKey(b) === todayISO && !isCancelledBooking(b));
  // Active maids: staff who are active and scheduled to work today (not day off)
  const activeMaids = (store.staff || []).filter(s => s.active !== false && isWorkingDay(s, todayISO)).length;
  // Today financials — all non-cancelled bookings whose service date is today.
  // (todayBks already filters out cancelled, so their money never counts.)
  // Today Revenue  = total value of today's bookings.
  // Today Received = amount marked received on today's bookings.
  // Outstanding    = unpaid balance on today's bookings (per-booking clamp so an
  //                  overpaid booking can't create negative outstanding).
  const todayRevenue     = todayBks.reduce((s, b) => s + (Number(b.total) || 0), 0);
  const todayReceived    = todayBks.reduce((s, b) => s + (Number(b._raw?.paid_amount) || 0), 0);
  // Outstanding spans ALL non-cancelled bookings (not just today) so the Overview
  // reflects the company's total unpaid balance. Per-booking clamp keeps an
  // overpaid booking from creating negative outstanding.
  const totalOutstanding = bookings
    .filter(b => !isCancelledBooking(b))
    .reduce((s, b) => s + Math.max(0, (Number(b.total) || 0) - (Number(b._raw?.paid_amount) || 0)), 0);
  const dynamicKpis = [
    { label: "Bookings Today",  value: String(todayBks.length),          unit: "jobs",    icon: "calendar", tone: "mint" },
    { label: "Active Maids",    value: String(activeMaids),              unit: "working", icon: "users",    tone: "ink"  },
    { label: "Today Revenue",   value: todayRevenue.toLocaleString(),    unit: "QAR",     icon: "money",    tone: "mint" },
    { label: "Today Received",  value: todayReceived.toLocaleString(),   unit: "QAR",     icon: "check",    tone: "mint" },
    { label: "Outstanding",     value: totalOutstanding.toLocaleString(), unit: "QAR",    icon: "money",    tone: totalOutstanding > 0 ? "warn" : "ink" },
  ];
  const sections = {
    overview:      <OverviewSection store={store} set={set} kpis={dynamicKpis} bookings={bookings}/>,
    bookings:      <BookingsSection bookings={bookings} store={store} set={set} loading={bLoading} externalQuery={globalSearch} externalPayFilter={payFilter} onPayFilterChange={setPayFilter}/>,
    hourly:        <HourlySection store={store} set={set}/>,
    monthly:       <MonthlySection store={store} set={set}/>,
    stayin:        <StayInSection store={store} set={set}/>,
    nationalities: <NationalitiesSection store={store} set={set}/>,
    materials:     <MaterialsSection store={store} set={set}/>,
    calendar:      <CalendarSection store={store} set={set} bookings={bookings}/>,
    customers:     <CustomerSection />,
    staff:         <StaffSection store={store} set={set} bookings={bookings}/>,
    settings:      <SettingsSection store={store} set={set}/>,
    'daily-report': <ReportsSection bookings={bookings} store={store} reportType="daily"/>,
    'staff-report': <ReportsSection bookings={bookings} store={store} reportType="staff"/>,
  };

  return (
    <div key={'lang-' + adminLang} ref={adminRootRef} className="flex flex-row min-h-[100dvh] bg-ink-50" data-screen-label="01 Admin Dashboard">
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <Sidebar active={section} onNav={setSection} bookingsCount={bookings.length} brand={store.brand}/>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setDrawerOpen(false)}/>
          <div className="relative animate-[fadeUp_.2s_ease]">
            <Sidebar active={section} onNav={setSection} onClose={() => setDrawerOpen(false)} mobile bookingsCount={bookings.length} brand={store.brand}/>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <BottomNav section={section} onNav={(s) => { setSection(s); }} onMenu={() => setDrawerOpen(true)}/>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col min-h-[100dvh]">
        <TopBar section={section} onMenu={() => setDrawerOpen(true)} store={store} onClear={clearAll} searchQuery={globalSearch} onSearch={setGlobalSearch} bookings={bookings}/>

        {/* Booking link for this company */}
        {companySlug && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-xl bg-mint-50 ring-1 ring-mint-200 px-4 py-2.5 flex items-center gap-2">
            <AdminIcon name="globe" className="w-4 h-4 text-mint-700 flex-shrink-0"/>
            <span className="hidden sm:inline text-[12.5px] font-semibold text-ink-600 flex-shrink-0">Booking link:</span>
            <CopyLinkInline slug={companySlug}/>
          </div>
        )}

        {/* Supabase connection banner */}
        {dbStatus === 'error' && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-red-100 text-red-600 grid place-items-center flex-shrink-0 mt-0.5">
                <AdminIcon name="x" className="w-4 h-4" strokeWidth={2.4}/>
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold text-red-800">Cannot reach Supabase — saves will fail</div>
                <div className="text-[12px] text-red-700 mt-0.5 leading-snug">
                  <strong>Error:</strong> {dbError}
                </div>
                <div className="text-[12px] text-red-700 mt-1.5 leading-snug space-y-0.5">
                  <div><strong>Most likely fix:</strong> Your free-tier Supabase project is <strong>paused</strong> due to inactivity.</div>
                  <div>Go to <strong>supabase.com/dashboard</strong> → select your project → click <strong>"Restore project"</strong>.</div>
                  <div className="text-[11.5px] text-red-600 mt-1">Project: <span className="font-mono">krijpvoonlpwxinohthb</span></div>
                </div>
              </div>
            </div>
            <button onClick={checkConnection}
              className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold transition-colors self-start sm:self-center">
              <AdminIcon name="sparkle" className="w-3.5 h-3.5"/>
              Retry
            </button>
          </div>
        )}
        {dbStatus === 'checking' && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-xl bg-ink-50 ring-1 ring-ink-200 px-4 py-2.5 flex items-center gap-2 text-[12.5px] text-ink-600">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-pulse flex-shrink-0"></span>
            Checking Supabase connection…
          </div>
        )}

        <main className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-[1480px] w-full mx-auto pb-20 lg:pb-6">
          {sections[section]}
        </main>
        <footer className="hidden lg:flex px-4 sm:px-6 lg:px-8 py-5 text-[11.5px] font-mono uppercase tracking-[0.14em] text-ink-500 items-center justify-between border-t border-ink-200/70">
          <span>© Maid Pro Admin · 2026</span>
          <span>v2.4.0 · Build 18a3f</span>
        </footer>
      </div>
    </div>
  );
};

/* ─── Shared full-screen states ─── */
const FullScreenSpinner = () => (
  <div className="min-h-screen bg-ink-950 flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-mint-500 border-t-transparent animate-spin"/>
  </div>
);

const NoAccessScreen = ({ message, title }) => (
  <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-float p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 grid place-items-center mx-auto">
        <AdminIcon name="x" className="w-6 h-6" strokeWidth={2.4}/>
      </div>
      <h1 className="text-[18px] font-extrabold text-ink-900">{title || 'No admin access'}</h1>
      <p className="text-[13px] text-ink-500 leading-snug">
        {message || 'This account is not linked to an admin profile. Contact your administrator.'}
      </p>
      <button onClick={() => supabase.auth.signOut()}
        className="w-full h-10 rounded-xl border border-ink-200 text-[13.5px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors">
        Sign out
      </button>
    </div>
  </div>
);

/* ─── Super Admin: create a company_admin login for a company ───
   Calls the create-company-admin Edge Function, which runs server-side with
   the service_role key (never exposed here) and enforces super-admin only. */
const AddAdminModal = ({ company, onClose }) => {
  const [email, setEmail]       = React.useState('');
  const [password, setPassword] = React.useState('');
  const [saving, setSaving]     = React.useState(false);
  const [err, setErr]           = React.useState('');
  const [done, setDone]         = React.useState(false);

  const submit = async () => {
    if (!email.trim()) { setErr('Email is required.'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setSaving(true); setErr('');
    const { data, error } = await supabase.functions.invoke('create-company-admin', {
      body: { email: email.trim(), password, company_id: company.id },
    });
    setSaving(false);
    if (error) {
      // Non-2xx responses surface as FunctionsHttpError; the JSON body is in error.context
      let msg = error.message || 'Failed to create admin.';
      try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch (_) {}
      setErr(msg);
      return;
    }
    if (data?.error) { setErr(data.error); return; }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-float p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold text-ink-900">Add admin</h3>
          <button onClick={() => !saving && onClose()} className="text-ink-400 hover:text-ink-700">
            <AdminIcon name="x" className="w-5 h-5"/>
          </button>
        </div>
        <p className="text-[12.5px] text-ink-500 leading-snug -mt-1">
          Creates a <strong>company admin</strong> login for <strong>{company.name}</strong>. They will only see this company's data.
        </p>

        {done ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 ring-1 ring-green-200 px-4 py-3 text-[13px] text-green-800">
              <div className="font-bold">Admin created ✓</div>
              <div className="mt-0.5 leading-snug"><span className="font-mono">{email.trim().toLowerCase()}</span> can now log in and will see only <strong>{company.name}</strong>.</div>
            </div>
            <button onClick={onClose}
              className="w-full h-11 rounded-xl bg-mint-500 hover:bg-mint-400 active:bg-mint-600 text-ink-900 font-bold text-[13.5px] shadow-mint transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Email</label>
              <input type="email" value={email} autoFocus autoComplete="off"
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full h-11 px-3 rounded-xl bg-white hairline text-[14px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Temporary password</label>
              <input type="text" value={password} autoComplete="off"
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full h-11 px-3 rounded-xl bg-white hairline text-[14px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
              <p className="text-[11px] text-ink-400 mt-1">Share this with the admin — they can change it later via “forgot password”.</p>
            </div>
            {err && <div className="text-[12.5px] text-red-600 font-medium">{err}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} disabled={saving}
                className="flex-1 h-11 rounded-xl border border-ink-200 text-[13.5px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors">
                Cancel
              </button>
              <button onClick={submit} disabled={saving}
                className="flex-1 h-11 rounded-xl bg-mint-500 hover:bg-mint-400 active:bg-mint-600 disabled:opacity-60 text-ink-900 font-bold text-[13.5px] shadow-mint transition-colors">
                {saving ? 'Creating…' : 'Create admin'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── Super Admin: list + remove company_admin logins for a company ───
   Reads/writes via the manage-company-admins Edge Function (super-admin only,
   service_role server-side). Remove uses inline confirm-before-delete. */
const ViewAdminsModal = ({ company, onClose }) => {
  const [admins, setAdmins]       = React.useState(null); // null = loading
  const [err, setErr]             = React.useState('');
  const [confirmId, setConfirmId] = React.useState(null);
  const [removingId, setRemovingId] = React.useState(null);
  const [resetId, setResetId]     = React.useState(null); // row in reset-password mode
  const [resetPass, setResetPass] = React.useState('');
  const [resetBusy, setResetBusy] = React.useState(false);
  const [resetDoneId, setResetDoneId] = React.useState(null); // row that just succeeded

  const parseErr = async (error, fallback) => {
    let msg = error.message || fallback;
    try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch (_) {}
    return msg;
  };

  const load = React.useCallback(async () => {
    setErr('');
    const { data, error } = await supabase.functions.invoke('manage-company-admins', {
      body: { action: 'list', company_id: company.id },
    });
    if (error) { setErr(await parseErr(error, 'Failed to load admins.')); setAdmins([]); return; }
    if (data?.error) { setErr(data.error); setAdmins([]); return; }
    setAdmins(data.admins || []);
  }, [company.id]);

  React.useEffect(() => { load(); }, [load]);

  const remove = async (userId) => {
    setRemovingId(userId); setErr('');
    const { data, error } = await supabase.functions.invoke('manage-company-admins', {
      body: { action: 'remove', company_id: company.id, user_id: userId },
    });
    setRemovingId(null);
    if (error) { setErr(await parseErr(error, 'Failed to remove admin.')); return; }
    if (data?.error) { setErr(data.error); return; }
    setConfirmId(null);
    load();
  };

  const openReset = (userId) => {
    setResetId(userId); setResetPass(''); setConfirmId(null);
    setErr(''); setResetDoneId(null);
  };

  const resetPassword = async (userId) => {
    if (resetPass.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setResetBusy(true); setErr('');
    const { data, error } = await supabase.functions.invoke('manage-company-admins', {
      body: { action: 'reset_password', company_id: company.id, user_id: userId, new_password: resetPass },
    });
    setResetBusy(false);
    if (error) { setErr(await parseErr(error, 'Failed to reset password.')); return; }
    if (data?.error) { setErr(data.error); return; }
    setResetId(null); setResetPass(''); setResetDoneId(userId);
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-float p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold text-ink-900">Admins · {company.name}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <AdminIcon name="x" className="w-5 h-5"/>
          </button>
        </div>

        {err && <div className="text-[12.5px] text-red-600 font-medium">{err}</div>}

        {admins === null ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-500 py-8 justify-center">
            <span className="w-5 h-5 rounded-full border-2 border-mint-500 border-t-transparent animate-spin"/>
            Loading admins…
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center text-[13px] text-ink-500 py-8">
            No admins yet for this company. Use <strong>Add admin</strong> to create one.
          </div>
        ) : (
          <ul className="divide-y divide-ink-200/70 -mx-1">
            {admins.map(a => (
              <li key={a.user_id} className="px-1 py-2.5">
                {confirmId === a.user_id ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0 text-[13px] text-ink-700">
                      Remove <span className="font-semibold break-all">{a.email}</span>?
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setConfirmId(null)} disabled={removingId === a.user_id}
                        className="flex-1 sm:flex-none h-8 px-3 rounded-lg border border-ink-200 text-[12.5px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors">
                        Cancel
                      </button>
                      <button onClick={() => remove(a.user_id)} disabled={removingId === a.user_id}
                        className="flex-1 sm:flex-none h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[12.5px] font-semibold transition-colors">
                        {removingId === a.user_id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ) : resetId === a.user_id ? (
                  <div className="space-y-2">
                    <div className="text-[12.5px] text-ink-600">
                      New password for <span className="font-semibold break-all">{a.email}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input type="text" value={resetPass} autoFocus autoComplete="off"
                        onChange={e => setResetPass(e.target.value)}
                        placeholder="At least 6 characters"
                        className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-white hairline text-[13px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => { setResetId(null); setResetPass(''); }} disabled={resetBusy}
                          className="flex-1 sm:flex-none h-9 px-3 rounded-lg border border-ink-200 text-[12.5px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors">
                          Cancel
                        </button>
                        <button onClick={() => resetPassword(a.user_id)} disabled={resetBusy}
                          className="flex-1 sm:flex-none h-9 px-3 rounded-lg bg-mint-500 hover:bg-mint-400 active:bg-mint-600 disabled:opacity-60 text-ink-900 text-[12.5px] font-bold transition-colors">
                          {resetBusy ? 'Updating…' : 'Update'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold text-ink-900 font-mono break-all">{a.email}</div>
                        <div className="text-[11.5px] text-ink-500">Added {fmtDate(a.created_at)}</div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => openReset(a.user_id)}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-ink-200 text-ink-700 hover:bg-ink-50 text-[12.5px] font-semibold transition-colors">
                          <AdminIcon name="settings" className="w-3.5 h-3.5"/>
                          Reset password
                        </button>
                        <button onClick={() => { setConfirmId(a.user_id); setResetId(null); setErr(''); setResetDoneId(null); }}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[12.5px] font-semibold transition-colors">
                          <AdminIcon name="trash" className="w-3.5 h-3.5"/>
                          Remove
                        </button>
                      </div>
                    </div>
                    {resetDoneId === a.user_id && (
                      <div className="mt-2 rounded-lg bg-green-50 ring-1 ring-green-200 px-3 py-2 text-[12px] text-green-800 font-medium">
                        Password updated — share it with the admin.
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <button onClick={onClose}
          className="w-full h-10 rounded-xl border border-ink-200 text-[13.5px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors">
          Close
        </button>
      </div>
    </div>
  );
};

/* ─── Super Admin: permanently delete a company + everything it owns ───
   Destructive. Calls the delete-company Edge Function (super-admin only,
   service_role server-side). Requires typing the company name to confirm;
   the main company (Al Zahour) gets one extra final confirmation. */
const AL_ZAHOUR_ID = '00000000-0000-0000-0000-000000000001';

const DeleteCompanyModal = ({ company, onClose, onDeleted }) => {
  const [typed, setTyped] = React.useState('');
  const [stage, setStage] = React.useState('type'); // 'type' | 'final' (final only for the main company)
  const [busy, setBusy]   = React.useState(false);
  const [err, setErr]     = React.useState('');

  const nameMatches = typed.trim() === (company.name || '').trim();
  const isMain = String(company.id) === AL_ZAHOUR_ID;

  const doDelete = async () => {
    setBusy(true); setErr('');
    const { data, error } = await supabase.functions.invoke('delete-company', {
      body: { company_id: company.id },
    });
    setBusy(false);
    if (error) {
      let msg = error.message || 'Failed to delete company.';
      try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch (_) {}
      setErr(msg);
      return;
    }
    if (data?.error) { setErr(data.error); return; }
    onDeleted();
  };

  const onPrimary = () => {
    if (!nameMatches || busy) return;
    if (isMain && stage === 'type') { setStage('final'); return; }
    doDelete();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-float p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold text-red-700">Delete company</h3>
          <button onClick={() => !busy && onClose()} className="text-ink-400 hover:text-ink-700">
            <AdminIcon name="x" className="w-5 h-5"/>
          </button>
        </div>

        {stage === 'type' ? (
          <>
            <div className="rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3 text-[12.5px] text-red-800 leading-snug space-y-1">
              <div className="font-bold">This permanently deletes <span className="break-all">{company.name}</span>.</div>
              <div>
                It erases <strong>all</strong> of its bookings, staff, customers, settings, nationalities,
                schedules, availability, services — and <strong>all of its admin logins</strong>. This cannot be undone.
              </div>
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">
                Type <span className="font-mono normal-case text-ink-900">{company.name}</span> to confirm
              </label>
              <input value={typed} autoFocus autoComplete="off"
                onChange={e => setTyped(e.target.value)}
                placeholder={company.name}
                className="w-full h-11 px-3 rounded-xl bg-white hairline text-[14px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
            </div>
            {err && <div className="text-[12.5px] text-red-600 font-medium">{err}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} disabled={busy}
                className="flex-1 h-11 rounded-xl border border-ink-200 text-[13.5px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors">
                Cancel
              </button>
              <button onClick={onPrimary} disabled={!nameMatches || busy}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[13.5px] transition-colors">
                {busy ? 'Deleting…' : (isMain ? 'Continue' : 'Delete company')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3 text-[13px] text-red-800 leading-snug font-medium">
              This is your main company <strong>Al Zahour</strong>. Deleting it erases all its real data
              permanently. Are you absolutely sure?
            </div>
            {err && <div className="text-[12.5px] text-red-600 font-medium">{err}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} disabled={busy}
                className="flex-1 h-11 rounded-xl border border-ink-200 text-[13.5px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors">
                Cancel
              </button>
              <button onClick={doDelete} disabled={busy}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-[13.5px] transition-colors">
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── Super Admin: banner shown while impersonating a company ─── */
const ViewingBanner = ({ company, onBack }) => {
  const [addAdmin, setAddAdmin]   = React.useState(false);
  const [viewAdmins, setViewAdmins] = React.useState(false);
  return (
  <div className="sticky top-0 z-50 bg-ink-950 text-white px-3 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2 sm:gap-3 shadow-md">
    <span className="w-7 h-7 rounded-lg bg-mint-500 text-ink-900 grid place-items-center flex-shrink-0">
      <AdminIcon name="grid" className="w-4 h-4" strokeWidth={2.2}/>
    </span>
    <div className="min-w-0 flex-1">
      <div className="text-[13px] font-bold leading-tight truncate">
        Viewing: {company.name}
      </div>
      <div className="text-[11px] text-white/60 leading-tight truncate">
        Super Admin · {company.plan || 'No plan'}{company.active === false ? ' · inactive' : ''}
      </div>
    </div>
    <button onClick={() => setViewAdmins(true)} aria-label="View admins"
      className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12.5px] font-semibold transition-colors">
      <AdminIcon name="users" className="w-3.5 h-3.5" strokeWidth={2.2}/>
      <span className="hidden sm:inline">View admins</span>
    </button>
    <button onClick={() => setAddAdmin(true)} aria-label="Add admin"
      className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12.5px] font-semibold transition-colors">
      <AdminIcon name="plus" className="w-3.5 h-3.5" strokeWidth={2.4}/>
      <span className="hidden sm:inline">Add admin</span>
    </button>
    <button onClick={onBack} aria-label="Back to all companies"
      className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12.5px] font-semibold transition-colors">
      <AdminIcon name="arrow-left" className="w-3.5 h-3.5" strokeWidth={2.2}/>
      <span className="hidden sm:inline">Back to all companies</span>
    </button>
    {addAdmin && <AddAdminModal company={company} onClose={() => setAddAdmin(false)} />}
    {viewAdmins && <ViewAdminsModal company={company} onClose={() => setViewAdmins(false)} />}
  </div>
  );
};

/* ─── Super Admin: top-level dashboard listing every company ─── */
const PLAN_OPTIONS = ['Basic', 'Pro', 'Enterprise'];

const SuperAdminDashboard = ({ onView }) => {
  const [companies, setCompanies] = React.useState(null); // null = loading
  const [counts, setCounts]       = React.useState({ bookings: {}, staff: {}, customers: {} });
  const [error, setError]         = React.useState('');
  const [addOpen, setAddOpen]     = React.useState(false);
  const [form, setForm]           = React.useState({ name: '', plan: 'Basic', active: true, slug: '' });
  const [slugEdited, setSlugEdited] = React.useState(false); // true once the user types in the slug field
  const [saving, setSaving]       = React.useState(false);
  const [formErr, setFormErr]     = React.useState('');
  const [adminFor, setAdminFor]   = React.useState(null); // company whose "Add admin" modal is open
  const [viewAdminsFor, setViewAdminsFor] = React.useState(null); // company whose "View admins" modal is open
  const [deleteFor, setDeleteFor] = React.useState(null); // company whose "Delete company" modal is open

  const fetchAll = React.useCallback(async () => {
    const { data: cos, error: coErr } = await supabase.from('companies').select('*').order('name');
    if (coErr) { setError(coErr.message); setCompanies([]); return; }
    setError('');
    setCompanies(cos || []);
    // Counts: pull company_id columns across tenant tables and tally client-side
    // (one query per table regardless of how many companies exist).
    const [bk, st, cu] = await Promise.all([
      supabase.from('bookings').select('company_id'),
      supabase.from('staff').select('company_id'),
      supabase.from('customers').select('company_id'),
    ]);
    const tally = (res) => {
      const m = {};
      (res.data || []).forEach(r => { if (r.company_id != null) m[r.company_id] = (m[r.company_id] || 0) + 1; });
      return m;
    };
    setCounts({ bookings: tally(bk), staff: tally(st), customers: tally(cu) });
  }, []);

  React.useEffect(() => { fetchAll(); }, [fetchAll]);

  // URL-friendly slug: lowercase, keep a-z/0-9, collapse the rest to single dashes.
  const slugify = (s) => (s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const addCompany = async () => {
    if (!form.name.trim()) { setFormErr('Company name is required.'); return; }
    const slug = slugify(form.slug || form.name);
    if (!slug) { setFormErr('A booking-link slug is required (letters/numbers).'); return; }
    setSaving(true); setFormErr('');
    const { error: insErr } = await supabase.from('companies')
      .insert({ name: form.name.trim(), plan: form.plan, active: form.active, slug });
    setSaving(false);
    if (insErr) {
      const taken = insErr.code === '23505' || /duplicate|unique/i.test(insErr.message || '');
      setFormErr(taken ? `The slug "${slug}" is already taken — choose another.` : insErr.message);
      return;
    }
    setAddOpen(false);
    setForm({ name: '', plan: 'Basic', active: true, slug: '' });
    setSlugEdited(false);
    fetchAll();
  };

  // Toggle a company active/inactive. Optimistic, reverts on error.
  // (Allowed by the super_admin_companies RLS policy; this view is super-admin only.)
  const toggleActive = async (c) => {
    const next = c.active === false; // currently inactive → activate, else deactivate
    setError('');
    setCompanies(cs => cs.map(x => x.id === c.id ? { ...x, active: next } : x));
    const { error: upErr } = await supabase.from('companies').update({ active: next }).eq('id', c.id);
    if (upErr) {
      setCompanies(cs => cs.map(x => x.id === c.id ? { ...x, active: c.active } : x)); // revert
      setError(`Could not update ${c.name}: ${upErr.message}`);
    }
  };

  const planTone = (plan) => ({
    Basic:      'bg-ink-100 text-ink-700',
    Pro:        'bg-mint-100 text-mint-700',
    Enterprise: 'bg-violet-100 text-violet-700',
  }[plan] || 'bg-ink-100 text-ink-700');

  return (
    <div className="min-h-[100dvh] bg-ink-50">
      {/* Header */}
      <header className="bg-ink-950 text-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-mint-500 text-ink-900 grid place-items-center flex-shrink-0 shadow-mint">
            <AdminIcon name="sparkle" className="w-5 h-5" strokeWidth={2.2}/>
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-extrabold tracking-tight leading-tight">Super Admin</h1>
            <p className="text-[12px] text-white/60 leading-tight">All companies</p>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors">
            <AdminIcon name="logout" className="w-4 h-4"/>
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-[15px] font-bold text-ink-900">
            Companies {companies ? `(${companies.length})` : ''}
          </h2>
          <button onClick={() => { setAddOpen(true); setFormErr(''); }}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-mint-500 hover:bg-mint-400 active:bg-mint-600 text-ink-900 font-bold text-[13.5px] shadow-mint transition-colors">
            <AdminIcon name="plus" className="w-4 h-4" strokeWidth={2.4}/>
            Add company
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3 text-[13px] text-red-700 mb-5">
            <strong>Could not load companies:</strong> {error}
          </div>
        )}

        {companies === null ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-500 py-10 justify-center">
            <span className="w-5 h-5 rounded-full border-2 border-mint-500 border-t-transparent animate-spin"/>
            Loading companies…
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center text-[13px] text-ink-500 py-10">
            No companies yet. Click <strong>Add company</strong> to create the first one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map(c => (
              <div key={c.id} className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-ink-900 truncate">{c.name}</h3>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${planTone(c.plan)}`}>
                        {c.plan || 'No plan'}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.active === false ? 'bg-ink-100 text-ink-500' : 'bg-green-100 text-green-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.active === false ? 'bg-ink-400' : 'bg-green-500'}`}/>
                        {c.active === false ? 'Inactive' : 'Active'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Bookings',  value: counts.bookings[c.id]  || 0 },
                    { label: 'Staff',     value: counts.staff[c.id]     || 0 },
                    { label: 'Customers', value: counts.customers[c.id] || 0 },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl bg-ink-50 py-2.5">
                      <div className="text-[18px] font-extrabold text-ink-900 leading-none">{s.value}</div>
                      <div className="text-[10.5px] font-semibold text-ink-500 uppercase tracking-wide mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-ink-50 px-3 py-2">
                  <div className="text-[10.5px] font-semibold text-ink-500 uppercase tracking-wide mb-1">Booking link</div>
                  <CopyLinkInline slug={c.slug}/>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2">
                  <span className="text-[12.5px] font-semibold text-ink-700">
                    {c.active === false ? 'Company disabled' : 'Company active'}
                  </span>
                  <Switch on={c.active !== false} onChange={() => toggleActive(c)} ariaLabel={`Toggle ${c.name} active`}/>
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button onClick={() => setAdminFor(c)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-ink-200 text-ink-700 hover:bg-ink-50 font-semibold text-[13px] transition-colors">
                      <AdminIcon name="plus" className="w-4 h-4" strokeWidth={2.4}/>
                      Add admin
                    </button>
                    <button onClick={() => setViewAdminsFor(c)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-ink-200 text-ink-700 hover:bg-ink-50 font-semibold text-[13px] transition-colors">
                      <AdminIcon name="users" className="w-4 h-4" strokeWidth={2}/>
                      View admins
                    </button>
                  </div>
                  <button onClick={() => onView(c)}
                    className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-semibold text-[13px] transition-colors">
                    View as
                    <AdminIcon name="arrow-right" className="w-4 h-4" strokeWidth={2.2}/>
                  </button>
                  <button onClick={() => setDeleteFor(c)}
                    className="self-center mt-0.5 text-[11.5px] font-semibold text-red-500/80 hover:text-red-700 hover:underline transition-colors">
                    Delete company
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add company modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && setAddOpen(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-float p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-extrabold text-ink-900">Add company</h3>
              <button onClick={() => !saving && setAddOpen(false)} className="text-ink-400 hover:text-ink-700">
                <AdminIcon name="x" className="w-5 h-5"/>
              </button>
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Company name</label>
              <input value={form.name} autoFocus
                onChange={e => {
                  const name = e.target.value;
                  // Auto-suggest the slug from the name until the user edits the slug field.
                  setForm(f => ({ ...f, name, slug: slugEdited ? f.slug : slugify(name) }));
                }}
                placeholder="e.g. Sparkle Cleaning"
                className="w-full h-11 px-3 rounded-xl bg-white hairline text-[14px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Booking-link slug</label>
              <input value={form.slug}
                onChange={e => { setSlugEdited(true); setForm(f => ({ ...f, slug: e.target.value })); }}
                placeholder="e.g. sparkle"
                className="w-full h-11 px-3 rounded-xl bg-white hairline text-[14px] text-ink-900 font-mono outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
              <p className="text-[11px] text-ink-400 mt-1 truncate">
                Booking link: <span className="font-mono">{window.location.origin}/{slugify(form.slug || form.name) || '…'}</span>
              </p>
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Plan</label>
              <select value={form.plan}
                onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl bg-white hairline text-[14px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
                {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Switch on={form.active} onChange={(v) => setForm(f => ({ ...f, active: v }))} ariaLabel="Active"/>
              <span className="text-[13.5px] font-semibold text-ink-700">Active</span>
            </label>
            {formErr && <div className="text-[12.5px] text-red-600 font-medium">{formErr}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAddOpen(false)} disabled={saving}
                className="flex-1 h-11 rounded-xl border border-ink-200 text-[13.5px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors">
                Cancel
              </button>
              <button onClick={addCompany} disabled={saving}
                className="flex-1 h-11 rounded-xl bg-mint-500 hover:bg-mint-400 active:bg-mint-600 disabled:opacity-60 text-ink-900 font-bold text-[13.5px] shadow-mint transition-colors">
                {saving ? 'Adding…' : 'Add company'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add admin modal */}
      {adminFor && <AddAdminModal company={adminFor} onClose={() => setAdminFor(null)} />}

      {/* View admins modal */}
      {viewAdminsFor && <ViewAdminsModal company={viewAdminsFor} onClose={() => setViewAdminsFor(null)} />}

      {/* Delete company modal */}
      {deleteFor && (
        <DeleteCompanyModal company={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDeleted={() => { setDeleteFor(null); fetchAll(); }} />
      )}
    </div>
  );
};

/* ─── Authenticated router: reads profile, routes by role, sets tenant scope ─── */
const AuthedAdmin = ({ session }) => {
  const [profile, setProfile] = React.useState(undefined); // undefined = loading, null = none
  const [companyActive, setCompanyActive] = React.useState(undefined); // company_admin only
  const [companySlug, setCompanySlug] = React.useState(null); // company_admin only
  const [viewingCompany, setViewingCompany] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      const prof = error ? null : (data || null);
      setProfile(prof);
      // Company admins are blocked if their company is inactive. Super admins
      // are never company-gated, so skip the lookup for them.
      if (prof?.role === 'company_admin' && prof.company_id) {
        const { data: co } = await supabase
          .from('companies')
          .select('active, slug')
          .eq('id', prof.company_id)
          .maybeSingle();
        if (cancelled) return;
        // Unreadable/missing company → treat as blocked (fail safe).
        setCompanyActive(co ? (co.active !== false) : false);
        setCompanySlug(co?.slug || null);
      }
    })();
    return () => { cancelled = true; };
  }, [session.user.id]);

  if (profile === undefined) return <FullScreenSpinner/>;

  if (!profile || (profile.role !== 'super_admin' && profile.role !== 'company_admin')) {
    return <NoAccessScreen/>;
  }

  // Company admin → straight into their own company, no dashboard, no banner.
  if (profile.role === 'company_admin') {
    if (!profile.company_id) {
      return <NoAccessScreen message="This admin account isn't linked to a company yet."/>;
    }
    if (companyActive === undefined) return <FullScreenSpinner/>; // company-active check in flight
    if (companyActive === false) {
      return <NoAccessScreen title="Account disabled"
        message="This account is disabled. Please contact support."/>;
    }
    setScopedCompany(profile.company_id);
    return <AdminPanel key={profile.company_id} companyId={profile.company_id} companySlug={companySlug} />;
  }

  // Super admin → company dashboard first; "View as" loads a scoped AdminPanel.
  if (viewingCompany) {
    setScopedCompany(viewingCompany.id);
    return (
      <>
        <ViewingBanner company={viewingCompany}
          onBack={() => { setScopedCompany(null); setViewingCompany(null); }} />
        <AdminPanel key={viewingCompany.id} companyId={viewingCompany.id} companySlug={viewingCompany.slug} />
      </>
    );
  }
  setScopedCompany(null);
  return <SuperAdminDashboard onView={(c) => { setScopedCompany(c.id); setViewingCompany(c); }} />;
};

const App = () => {
  const [session, setSession]       = React.useState(null);
  const [loading, setLoading]       = React.useState(true);
  const [resetMode, setResetMode]   = React.useState(false);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <FullScreenSpinner/>;
  if (resetMode || !session) return <LoginScreen onResetActive={setResetMode} />;
  return <AuthedAdmin session={session} />;
};

export default App;


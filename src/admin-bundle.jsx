import React from 'react'
import { supabase, fmtBooking, broadcastSettingsUpdate } from './supabase'
import { SVC_ICONS, SVC_ICON_NAMES, SvcIcon } from './serviceIcons'

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
  if (!Array.isArray(days) || days.length === 0) return true; // default: all days
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
    default: return null;
  }
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
      const { error } = await supabase.from('settings').upsert({ key: 'modes', value: newModes });
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
  const [savedH, setSavedH] = React.useState(false);
  const saveHourly = async () => {
    setSavedH(false);
    try {
      const { error } = await supabase.from('settings').upsert([
        { key:'services', value:store.services },
        { key:'limits',   value:store.limits   },
      ]);
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
      const { error } = await supabase.from('settings').upsert([
        { key:'monthly',         value:store.monthly },
        { key:'monthlySettings', value:ms            }
      ]);
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
      const { error } = await supabase.from('settings').upsert([
        { key:'stayIn',         value:store.stayIn },
        { key:'stayinSettings', value:sis          }
      ]);
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
      const { error } = await supabase.from('settings').upsert({ key: 'modes', value: newModes });
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
      const { error: blockErr } = await supabase.from('settings').upsert(
        { key: 'nationalities_block', value: { enabled: store.nationalitiesEnabled } }, { onConflict: 'key' }
      );
      if (blockErr) throw blockErr;
      const { error: natsErr } = await supabase.from('nationalities').upsert(natsPayload, { onConflict: 'id' });
      if (natsErr) throw natsErr;
      const { error: svcErr } = await supabase.from('settings').upsert({ key: 'services', value: store.services }, { onConflict: 'key' });
      if (svcErr) throw svcErr;
      const { error: mErr } = await supabase.from('settings').upsert({ key: 'monthly', value: store.monthly }, { onConflict: 'key' });
      if (mErr) throw mErr;
      const { error: sErr } = await supabase.from('settings').upsert({ key: 'stayIn', value: store.stayIn }, { onConflict: 'key' });
      if (sErr) throw sErr;
      broadcastSettingsUpdate();
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch(e) { alert('Save failed: ' + (e.message || 'Network error — check your connection.')); }
  };

  const update = (id, patch) => {
    set({ nationalities: store.nationalities.map(n => n.id === id ? { ...n, ...patch } : n) });
    const dbPatch = { ...patch };
    if ('on' in dbPatch) { dbPatch.enabled = dbPatch.on; delete dbPatch.on; }
    supabase.from('nationalities').update(dbPatch).eq('id', id);
  };
  const remove = (id) => {
    set({ nationalities: store.nationalities.filter(n => n.id !== id) });
    supabase.from('nationalities').delete().eq('id', id);
  };
  const add = () => {
    const n = { id: 'nat_' + Date.now(), name: 'New Nationality', flag: '🌍', on: true };
    set({ nationalities: [...store.nationalities, n] });
    supabase.from('nationalities').insert({ id: n.id, name: n.name, flag: n.flag, enabled: true });
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
      const { error } = await supabase.from('settings').upsert([
        { key:'materials', value:{ rate:store.materialsRate, enabled:store.materialsEnabled, items:store.materialsList } }
      ]);
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
    setOpen(o => !o);
  };
  const assigned = (store?.assignments?.[booking.ref]) || [];
  const toggle = async (id) => {
    if (!set || !store) return;
    const has = assigned.includes(id);
    const next = has ? assigned.filter(x => x !== id) : [...assigned, id];
    // All maids work the full booking duration simultaneously — no splitting
    const totalHours = Number(booking._raw?.hours ?? booking.hours ?? 4);
    const newStaffHours = Object.fromEntries(next.map(sid => [sid, totalHours]));
    set({
      assignments: { ...(store.assignments || {}), [booking.ref]: next },
      staffHours:  { ...(store.staffHours  || {}), [booking.ref]: newStaffHours },
    });
    if (booking._raw?.id) {
      await supabase.from('bookings').update({
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
          {(store?.staff || []).map(s => {
            const on = assigned.includes(s.id);
            const onLeave = s.status === "On-Leave";
            // Blocked = on-leave AND not currently assigned (can't add, but can remove)
            const blocked = onLeave && !on;
            return (
              <button key={s.id} onClick={() => !blocked && toggle(s.id)} disabled={blocked}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-[12.5px]
                  ${blocked ? "opacity-40 cursor-not-allowed" : "hover:bg-ink-50 cursor-pointer"}
                  ${on && !onLeave ? "bg-mint-50" : ""}
                  ${on && onLeave ? "bg-red-50" : ""}`}>
                <StaffAvatar s={s} size={26}/>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-900 truncate">{s.name}</div>
                  <div className="flex items-center gap-1 text-[10.5px] text-ink-500"><StatusDot status={s.status}/>{s.status}</div>
                </div>
                {on && !onLeave && <AdminIcon name="check" className="w-4 h-4 text-mint-700"/>}
                {on && onLeave && (
                  <span className="text-[10px] font-semibold text-red-500 whitespace-nowrap">Remove</span>
                )}
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
    if (effectiveQuery && !b.customer.toLowerCase().includes(effectiveQuery.toLowerCase()) && !b.ref.toLowerCase().includes(effectiveQuery.toLowerCase())) return false;
    const raw = b._raw?.date || '';
    if (dateFrom && raw < dateFrom) return false;
    if (dateTo   && raw > dateTo)   return false;
    return true;
  });
  const dateLabel = dateFrom
    ? (dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`)
    : '';

  const filters    = ["All", "Confirmed", "Pending", "In Progress", "Completed", "Cancelled"];
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
                      QAR {filtered.reduce((s,b)=>s+b.total,0).toLocaleString()} total
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
              <th className="px-3 py-3">Maids</th>
              <th className="px-3 py-3">Assigned to</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Payment</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-6 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
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
                <td className="px-3 py-3.5 text-[13px] font-mono tabular-nums text-ink-700">{b.maids} × {b.hours}h</td>
                <td className="px-3 py-3.5"><AssignStaff booking={b} store={store} set={set}/></td>
                <td className="px-3 py-3.5"><StatusPill status={b.status}/></td>
                <td className="px-3 py-3.5"><PaymentBadge booking={b}/></td>
                <td className="px-3 py-3.5 text-right">
                  <div className="font-mono tabular-nums text-[13.5px] font-semibold text-ink-900">
                    <span className="text-ink-500 mr-1 text-[10px]">QAR</span>{b.total.toLocaleString()}
                  </div>
                  {b.payment_status === 'Pending' && b.total > 0 && (
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
      <ul className="md:hidden divide-y divide-ink-200/70">
        {filtered.map(b => (
          <li key={b.ref} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono tabular-nums text-[12px] text-ink-500">{b.ref}</span>
                  <StatusPill status={b.status}/>
                  <PaymentBadge booking={b}/>
                </div>
                <div className="mt-1 text-[14.5px] font-bold text-ink-900 truncate">{b.customer}</div>
                <div className="text-[12px] text-ink-500">{b.service} · {b.date}</div>
              </div>
              <div className="text-right">
                <div className="font-mono tabular-nums text-[14px] font-semibold text-ink-900">
                  <span className="text-ink-500 mr-1 text-[10px]">QAR</span>{b.total.toLocaleString()}
                </div>
                <div className="text-[11.5px] font-mono text-ink-500 mt-0.5">{b.maids}×{b.hours}h</div>
              </div>
            </div>
          </li>
        ))}
      </ul>

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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
          {k.sub
            ? <div className="mt-2 text-[11.5px] font-semibold text-amber-600">{k.sub}</div>
            : <div className={`mt-2 text-[11.5px] font-medium flex items-center gap-1 ${k.delta >= 0 ? "text-mint-700" : "text-red-600"}`}>
                <AdminIcon name={k.delta >= 0 ? "arrow-up" : "arrow-down"} className="w-3 h-3" strokeWidth={2.2}/>
                {Math.abs(k.delta)}% vs last week
              </div>
          }
        </div>
      ))}
    </div>

    {/* Booking table */}
    <BookingsSection bookings={bookings.slice(0, 8)} store={store} set={set}/>

    {/* live-mode summary */}
    <Card title="Live Service Status" subtitle="At-a-glance of which booking modes are accepting new orders.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {store.modes.map(m => (
          <div key={m.id} className="rounded-xl hairline bg-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-lg grid place-items-center ${m.on ? "bg-mint-100 text-mint-700" : "bg-ink-100 text-ink-500"}`}>
                <span className="text-[18px]">{m.emoji}</span>
              </span>
              <div>
                <div className="text-[13.5px] font-bold text-ink-900">{m.name}</div>
                <div className={`text-[11.5px] font-mono ${m.on ? "text-mint-700" : "text-ink-500"}`}>
                  {m.on ? "â— ACCEPTING" : "â—‹ PAUSED"}
                </div>
              </div>
            </div>
            <span className="font-mono tabular-nums text-[13px] text-ink-700">{m.bookings}</span>
          </div>
        ))}
      </div>
    </Card>
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
  { id: "reports",       label: "Reports",          icon: "trend" },
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
  { id: "nationalities", label: "Nationalities",    icon: "globe" },
  { id: "materials",     label: "Materials",        icon: "spray" },
  { id: "settings",      label: "Settings",         icon: "settings" },
];

/* Bookings loaded live from Supabase */

/* KPIs calculated from real bookings */

const initialStore = () => ({
  modes: [
    { id: "hourly",  name: "Hourly Booking", icon: "Clock",    emoji: "⏱️", desc: "On-demand cleaning, billed by the hour.",  bookings: 31, on: true },
    { id: "monthly", name: "Monthly Plans",  icon: "Calendar", emoji: "📅", desc: "Recurring weekly cleaning packages.",       bookings: 12, on: true },
    { id: "stayin",  name: "Stay-In",        icon: "Home",     emoji: "🏠", desc: "Long-term live-in maid contracts.",         bookings: 4,  on: true },
  ],
  services: [
    { id: "regular", name: "Regular Cleaning",  icon: "Sparkles", rate: 15, on: true  },
    { id: "deep",    name: "Deep Cleaning",     icon: "SprayCan",  rate: 18, on: true  },
    { id: "movein",  name: "Move-in / Out",     icon: "Package",   rate: 20, on: true  },
    { id: "post",    name: "Post-Construction", icon: "HardHat",   rate: 25, on: false },
  ],
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
  monthly: [
    { id: "basic",    name: "Basic Package",    icon: "Leaf",        emoji: "🌿", maids: 1, daysPerWeek: 4, hoursPerDay: 4, priceMonthly: 960,  discountLabel: "" },
    { id: "standard", name: "Standard Package", emoji: "â­", maids: 1, daysPerWeek: 5, hoursPerDay: 4, priceMonthly: 1200, discountLabel: "MOST POPULAR" },
    { id: "premium",  name: "Premium Package",  icon: "ShieldCheck", emoji: "👑", maids: 2, daysPerWeek: 5, hoursPerDay: 4, priceMonthly: 2400, discountLabel: "" },
  ],
  stayIn: [
    { id: "si1",  name: "1 Month",   icon: "Home",        months: 1,  price: 5500,  save: 0,     notes: "Includes accommodation & food allowance." },
    { id: "si3",  name: "3 Months",  icon: "ShieldCheck", months: 3,  price: 15000, save: 1500,  notes: "Best for short contracts. Save 1,500 QAR." },
    { id: "si6",  name: "6 Months",  icon: "CheckCircle", months: 6,  price: 28500, save: 4500,  notes: "Visa processing included." },
    { id: "si12", name: "12 Months", icon: "Bed",         months: 12, price: 54000, save: 12000, notes: "Full annual contract — visa, insurance, end-of-service benefits." },
  ],
  materialsEnabled: true,
  materialsRate: 10,
  availability: {
    // YYYY-MM-DD : { blocked: boolean, morning: boolean, afternoon: boolean }
    "2026-05-13": { blocked: true,  morning: false, afternoon: false },
    "2026-05-15": { blocked: false, morning: true,  afternoon: false },
    "2026-05-20": { blocked: true,  morning: false, afternoon: false },
    "2026-05-23": { blocked: false, morning: false, afternoon: true  },
    "2026-05-27": { blocked: true,  morning: false, afternoon: false },
  },
  staff: [
    { id: "s1", name: "Maria Santos",    nationality: "philippines", status: "Available", color: "mint",   skills: ["regular","deep","movein"],            serviceTypes: ["hourly"],                    working_days: [0,1,2,3,4,5,6] },
    { id: "s2", name: "Anjali Sharma",   nationality: "indian",      status: "Busy",      color: "sky",    skills: ["regular","deep"],                    serviceTypes: ["hourly","monthly"],          working_days: [0,1,2,3,4,5,6] },
    { id: "s3", name: "Wendy Cruz",      nationality: "philippines", status: "Available", color: "pink",   skills: ["regular","deep","post"],              serviceTypes: ["hourly"],                    working_days: [0,1,2,3,4,5,6] },
    { id: "s4", name: "Amy Thapa",       nationality: "nepal",       status: "Available", color: "amber",  skills: ["regular","movein"],                  serviceTypes: ["hourly","stayin"],           working_days: [0,1,2,3,4,5,6] },
    { id: "s5", name: "Michael Okafor",  nationality: "nigeria",     status: "On-Leave",  color: "violet", skills: ["regular","post"],                    serviceTypes: ["hourly"],                    working_days: [0,1,2,3,4,5,6] },
    { id: "s6", name: "John Reyes",      nationality: "philippines", status: "Available", color: "sky",    skills: ["regular","deep","movein","post"],     serviceTypes: ["hourly","monthly","stayin"], working_days: [0,1,2,3,4,5,6] },
    { id: "s7", name: "Priya Gurung",    nationality: "nepal",       status: "Busy",      color: "mint",   skills: ["regular","deep"],                    serviceTypes: ["hourly","monthly"],          working_days: [0,1,2,3,4,5,6] },
    { id: "s8", name: "Roselle Tan",     nationality: "philippines", status: "Available", color: "pink",   skills: ["regular","deep","post"],              serviceTypes: ["hourly"],                    working_days: [0,1,2,3,4,5,6] },
  ],
  assignments: {
    "MP-2034": ["s1","s3"],
    "MP-2033": ["s2"],
    "MP-2032": ["s4","s6","s8"],
    "MP-2031": ["s1"],
    "MP-2030": ["s7"],
    "MP-2029": ["s3","s6"],
    "MP-2028": [],
    "MP-2027": ["s2"],
    "MP-2026": ["s8"],
    "MP-2025": ["s1","s7"],
    "MP-2024": ["s4"],
    "MP-2023": ["s6"],
  },
  materialsList: [
    "Microfibre mop & bucket",
    "All-purpose detergent",
    "Glass cleaner",
    "Bathroom disinfectant",
    "Floor cleaner (eco-friendly)",
    "Microfibre cloths (×6)",
    "Sponges & scrub pads",
    "Heavy-duty trash bags",
  ],
  businessHours: { open: 8, close: 19 },
  staffHours: {},   // { [bookingRef]: { [staffId]: hoursFloat } }
});

/* ─── Sidebar ─── */
const SERVICE_CHILD_IDS = ['hourly', 'monthly', 'stayin'];

const Sidebar = ({ active, onNav, onClose, mobile, bookingsCount = 0, brand = {} }) => {
  const [servicesOpen, setServicesOpen] = React.useState(() => SERVICE_CHILD_IDS.includes(active));
  const [syncTime, setSyncTime] = React.useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  React.useEffect(() => {
    const t = setInterval(() => setSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 60000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (SERVICE_CHILD_IDS.includes(active)) setServicesOpen(true);
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
            const groupActive = SERVICE_CHILD_IDS.includes(active);
            return (
              <div key={n.id}>
                <button
                  onClick={() => setServicesOpen(o => !o)}
                  className={`relative w-full flex items-center gap-3 h-10 px-3 rounded-lg text-[13.5px] font-medium transition-colors
                    ${groupActive ? "bg-white/10 text-white" : "text-ink-300 hover:bg-white/5 hover:text-white"}`}>
                  <AdminIcon name={n.icon} className="w-4 h-4"/>
                  <span className="flex-1 text-left">{n.label}</span>
                  <AdminIcon name="chevron"
                    className={`w-4 h-4 transition-transform duration-200 ${servicesOpen ? "rotate-180" : ""}`}/>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ease-in-out
                  ${servicesOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
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
            onClick={() => { try { localStorage.removeItem('mp_admin_auth'); } catch(_){} window.location.reload(); }}>
            <AdminIcon name="logout" className="w-4 h-4"/>
          </button>
        </div>
      </div>
    </aside>
  );
};

/* ─── Top bar ─── */
const TopBar = ({ section, onMenu, store, onClear, searchQuery, onSearch, bookings = [] }) => {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const newBookings = bookings.filter(b => (b.status || b._raw?.status) === 'New').slice(0, 8);
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
    reports: "Reports",
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
    reports: "Revenue, bookings and performance analytics.",
  };
  const liveModes = store.modes.filter(m => m.on).length;
  return (
    <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-ink-200/70">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
        <button onClick={onMenu} className="lg:hidden w-10 h-10 -ml-2 grid place-items-center rounded-lg text-ink-700 hover:bg-ink-100">
          <AdminIcon name="menu" className="w-5 h-5"/>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-500">
            <span>Admin</span>
            <span>/</span>
            <span className="text-ink-700">{titles[section]}</span>
          </div>
          <h1 className="text-[18px] sm:text-[20px] font-extrabold text-ink-900 tracking-tight truncate">{titles[section]}</h1>
        </div>

        <div className="hidden md:flex items-center gap-2 mr-1">
          <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-mint-50 hairline text-mint-800 text-[11.5px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-mint-500 pulse-dot"></span>
            {liveModes}/3 modes live
          </div>
        </div>

        <div className="hidden sm:block w-64">
          <TextField icon="search" value={searchQuery||''} onChange={v => onSearch && onSearch(v)} placeholder="Search bookings, customers..."/>
        </div>

        <button
          onClick={() => { if (window.confirm('Delete ALL bookings permanently? This cannot be undone.')) onClear(); }}
          className="h-9 px-3.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-[13px] font-semibold transition-colors flex items-center gap-1.5"
        >
          <AdminIcon name="trash" className="w-4 h-4"/>
          Clear
        </button>

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
    supabase.from('availability').select('*').then(({ data }) => {
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
    supabase.from('availability').upsert({ date: key, ...row })
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
    supabase.from('availability').upsert({ date: key, ...row })
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* Calendar */}
        <Card padded={false}>
          <div className="px-4 sm:px-6 pt-5 pb-3 flex items-center gap-3 border-b border-ink-200/70 flex-wrap">
            <div>
              <h3 className="text-[15px] font-bold text-ink-900 tracking-tight">{MONTHS_FULL[view.getMonth()]} {view.getFullYear()}</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-500">Tap a date to inspect or block. Long-press / right side opens slot editor.</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <IconBtn icon="arrow-left" onClick={() => navMonth(-1)} title="Previous month"/>
              <button onClick={() => { setView(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedKey(ymd(today)); }}
                className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-ink-700 hover:bg-ink-100">Today</button>
              <IconBtn icon="arrow-right" onClick={() => navMonth(1)} title="Next month"/>
            </div>
          </div>

          {/* Legend */}
          <div className="px-4 sm:px-6 py-3 border-b border-ink-200/70 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-ink-600">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-mint-100 ring-1 ring-mint-300"></span>Available</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-amber-100 ring-1 ring-amber-300"></span>Partial</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-red-50 ring-1 ring-red-300"></span>Blocked</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-mint-600"></span>Has bookings</span>
          </div>

          {/* Weekday header */}
          <div className="px-4 sm:px-6 pt-3 grid grid-cols-7 gap-1.5 text-center text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-500">
            {WEEKDAYS_SHORT.map(d => <div key={d} className="py-1">{d}</div>)}
          </div>

          {/* Date grid */}
          <div className="px-4 sm:px-6 pb-5 pt-1 grid grid-cols-7 gap-1.5">
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
                  className={`relative rounded-lg aspect-square sm:aspect-auto sm:h-20 p-1.5 sm:p-2 text-left transition-all ${cls}`}
                  aria-label={`${d.toDateString()} — ${entry.blocked ? "blocked" : partial ? "partial availability" : "available"}`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-[12.5px] sm:text-[13px] font-bold tabular-nums ${isToday ? "px-1.5 rounded-full bg-ink-900 text-white" : ""}`}>
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
                  {/* Booking dot — mobile */}
                  {todays.length > 0 && (
                    <span className="sm:hidden absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-mint-600"></span>
                  )}
                  {entry.blocked && (
                    <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 text-red-500">
                      <AdminIcon name="x" className="w-3 h-3" strokeWidth={2.4}/>
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
const STAFF_STATUSES = ["Available", "Busy", "On-Leave"];
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
const StatusDot = ({ status }) => {
  const map = { Available: "bg-mint-500", Busy: "bg-amber-500", "On-Leave": "bg-ink-400" };
  return <span className={`w-2 h-2 rounded-full ${map[status] || "bg-ink-300"}`}></span>;
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
      supabase.from('regular_schedules').select('*').order('created_at', { ascending: false }),
      supabase.from('staff').select('id, name, color, status'),
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

    // Skip dates that already have a confirmed booking for this customer
    const { data: existing } = await supabase.from('bookings')
      .select('date').eq('phone', schedule.customer_phone)
      .in('date', allSlots).neq('status', 'Cancelled');
    const existingDates = new Set((existing || []).map(b => b.date));
    const newSlots = allSlots.filter(d => !existingDates.has(d));

    if (!newSlots.length) {
      setGenResult(r => ({ ...r, [schedule.id]: { count: 0, msg: 'All slots already have bookings.' } }));
      setGenerating(null); return;
    }

    // Resolve staff: prefer saved preference, otherwise auto-pick by working_days
    let staffToUse = (schedule.assigned_staff || []).filter(Boolean);
    if (!staffToUse.length) {
      const { data: avail } = await supabase.from('staff').select('id, skills, working_days');
      if (avail?.length) {
        // For the schedule date, pick staff whose working_days includes that DOW
        const scheduleDow = schedule.date ? new Date(schedule.date + 'T00:00:00').getDay() : new Date().getDay();
        staffToUse = avail
          .filter(s => isWorkingDay(s, schedule.date || new Date().toISOString().split('T')[0]))
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

    const rows = newSlots.map((dateStr, i) => ({
      ref:            `MP-${String(refBase + i + 1).padStart(3, '0')}`,
      name:           schedule.customer_name,
      phone:          schedule.customer_phone,
      service:        schedule.service || 'Regular Cleaning',
      mode:           'hourly',
      date:           dateStr,
      time:           schedule.start_time || '9:00 AM',
      hours:          Number(schedule.hours) || 4,
      cleaners:       Number(schedule.maids) || 1,
      rate:           0,
      total:          0,
      status:         'Confirmed',
      assigned_staff: staffToUse,
      // Embed schedule ID so syncFutureBookings can find these bookings precisely
      notes:          `[sch:${schedule.id}] Recurring: ${label}`,
    }));

    const { error } = await supabase.from('bookings').insert(rows);
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
    const { data: allBks } = await supabase.from('bookings')
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
      ops.push(supabase.from('bookings').delete().in('id', toDelete));
    if (toUpdate.length)
      ops.push(supabase.from('bookings').update({
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
      ? await supabase.from('regular_schedules').insert(row)
      : await supabase.from('regular_schedules').update(row).eq('id', draft.id);
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
    await supabase.from('regular_schedules').delete().eq('id', id);
    setSchedules(s => s.filter(x => x.id !== id));
  };

  const toggleActive = async (id, active) => {
    setSchedules(s => s.map(x => x.id === id ? { ...x, active } : x));
    await supabase.from('regular_schedules').update({ active }).eq('id', id);
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

            {staffList.filter(s => s.status !== 'On-Leave').length > 0 && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1.5">
                  Preferred Staff <span className="font-normal normal-case text-ink-400">(auto-assigned if empty)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {staffList.filter(s => s.status !== 'On-Leave').map(s => {
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
  const [draft, setDraft] = React.useState({ name: '', phone: '', area: '', address: '', tag: 'new' });
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState('');
  const [tab, setTab] = React.useState('all');

  const fetchData = React.useCallback(async () => {
    const [{ data: custs }, { data: bks }] = await Promise.all([
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('bookings').select('phone, total, date, status').neq('status', 'Cancelled'),
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
    await supabase.from('customers').update({ tag }).eq('id', id);
  };

  const remove = async (id) => {
    await supabase.from('customers').delete().eq('id', id);
    setCustomers(cs => cs.filter(c => c.id !== id));
  };

  const openModal = () => {
    setDraft({ name: '', phone: '', area: '', address: '', tag: 'new' });
    setFormErr('');
    setModalOpen(true);
  };

  const saveNew = async () => {
    if (!draft.name.trim()) { setFormErr('Name is required.'); return; }
    if (!draft.phone.trim()) { setFormErr('Phone is required.'); return; }
    setFormErr('');
    setSaving(true);
    const custId = 'c_' + draft.phone.replace(/\D/g, '').slice(-10) + '_' + Date.now();
    const newCust = { id: custId, name: draft.name.trim(), phone: draft.phone.trim(), area: draft.area.trim(), address: draft.address.trim(), tag: draft.tag };
    const { error } = await supabase.from('customers').insert(newCust);
    if (error) { setFormErr(error.message); setSaving(false); return; }
    setCustomers(cs => [{ ...newCust, created_at: new Date().toISOString() }, ...cs]);
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
                      <div className="flex justify-end">
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
                <AdminIcon name="contact" className="w-5 h-5" strokeWidth={2.2}/>
              </div>
              <div className="flex-1">
                <h3 className="text-[16px] font-bold text-ink-900">Add New Customer</h3>
                <p className="text-[12.5px] text-ink-500 mt-0.5">Fill in the customer details below.</p>
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
              <PrimaryBtn onClick={saveNew} disabled={saving} className="flex-1">
                {saving ? 'Saving…' : 'Save Customer'}
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
    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) { console.error('Staff delete failed:', error.message); return; }
    set({ staff: store.staff.filter(s => s.id !== id) });
    setPendingChanges(p => { const n = { ...p }; delete n[id]; return n; });
  };

  // Name / nationality — save immediately (not blocked behind Save Changes)
  const updateImmediate = async (id, patch) => {
    set(prev => ({ staff: prev.staff.map(s => s.id === id ? { ...s, ...patch } : s) }));
    await supabase.from('staff').update(patch).eq('id', id);
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
        status: s.status,
        skills: encodeSkills(s.skills || [], s.serviceTypes || []),
        working_days: s.working_days ?? [0,1,2,3,4,5,6],
      };
      try {
        const { error } = await supabase.from('staff').update(dbPatch).eq('id', s.id);
        if (error) {
          if (error.code === 'PGRST204') {
            // working_days column not yet added — save without it
            const { error: e2 } = await supabase.from('staff').update({ status: dbPatch.status, skills: dbPatch.skills }).eq('id', s.id);
            if (e2) throw e2;
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

  const blankDraft = () => ({ name: '', nationality: store.nationalities.find(n => n.on !== false)?.id || '', status: 'Available', color: 'mint', skills: [], serviceTypes: [] });
  const [modalOpen, setModalOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(blankDraft);
  const toggleDraftSkill = (sk) => setDraft(d => ({ ...d, skills: d.skills.includes(sk) ? d.skills.filter(x => x !== sk) : [...d.skills, sk] }));
  const toggleDraftServiceType = (m) => setDraft(d => {
    const types = d.serviceTypes || ['hourly'];
    return { ...d, serviceTypes: types.includes(m) ? types.filter(x => x !== m) : [...types, m] };
  });
  const openModal = () => { setDraft(blankDraft()); setModalOpen(true); };
  const saveNew = () => {
    if (!draft.name.trim()) return;
    const encodedSkills = encodeSkills(draft.skills, draft.serviceTypes);
    const newStaff = { id: 's_' + Date.now(), ...draft, skills: encodedSkills };
    set({ staff: [...store.staff, newStaff] });
    supabase.from('staff').insert({ ...newStaff, serviceTypes: undefined });
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
        <div className="hidden md:grid grid-cols-[56px_1.2fr_1fr_1fr_1.2fr_1.4fr_100px_60px] gap-3 px-6 py-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-200/70 bg-ink-50/50">
          <div></div><div>Name</div><div>Nationality</div><div>Status</div><div>Services</div><div>Skills</div><div>Active jobs</div><div></div>
        </div>
        <ul>
          {store.staff.map((s, i) => {
            const jobs = Object.values(store.assignments || {}).filter(arr => arr.includes(s.id)).length;
            return (
              <li key={s.id} className={`px-4 sm:px-6 py-3 ${i ? "border-t border-ink-200/70" : ""}`}>
                <div className="grid grid-cols-[48px_1fr] md:grid-cols-[56px_1.2fr_1fr_1fr_1.2fr_1.4fr_100px_60px] gap-3 items-center">
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
                    <select
                      value={pendingChanges[s.id]?.status ?? s.status}
                      onChange={e => markPending(s.id, { status: e.target.value })}
                      className={`w-full h-10 px-3 rounded-lg hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)] transition-colors ${pendingChanges[s.id] ? "bg-mint-50 ring-1 ring-mint-400" : "bg-white"}`}>
                      {STAFF_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
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
                        return store.services.map(sv => {
                        const on = s.skills.includes(sv.id);
                        return (
                          <button key={sv.id}
                            disabled={!hourlyOn}
                            onClick={() => hourlyOn && toggleSkill(s.id, sv.id)}
                            title={!hourlyOn ? "Enable Hourly service first" : undefined}
                            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11.5px] font-semibold transition-colors
                              ${!hourlyOn
                                ? "opacity-35 cursor-not-allowed hairline text-ink-400"
                                : on ? "bg-mint-500 text-ink-900" : "hairline text-ink-600 hover:bg-ink-50"}`}>
                            <SvcIcon name={sv.icon} className="w-3.5 h-3.5" strokeWidth={1.75} />
                            {sv.name.split(" ")[0]}
                          </button>
                        );
                        });
                      })()}
                    </div>
                    {/* Working days toggle — Su Mo Tu We Th Fr Sa */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400 mr-0.5">Days:</span>
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
                    <div className="flex items-center gap-2 text-[12.5px] text-ink-700">
                      <StatusDot status={s.status}/>
                      <span className="font-mono tabular-nums">{jobs}</span>
                      <span className="text-ink-500">jobs</span>
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
                  <Label>Status</Label>
                  <select value={draft.status} onChange={e => setDraft(d => ({...d, status: e.target.value}))}
                    className="mt-1.5 w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
                    {STAFF_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
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
                  {store.services.map(sv => {
                    const on = draft.skills.includes(sv.id);
                    return (
                      <button key={sv.id} onClick={() => toggleDraftSkill(sv.id)}
                        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] font-semibold transition-colors
                          ${on ? "bg-mint-500 text-ink-900" : "hairline text-ink-600 hover:bg-ink-50"}`}>
                        <SvcIcon name={sv.icon} className="w-3.5 h-3.5" strokeWidth={1.75} />
                        {sv.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <GhostBtn size="sm" onClick={() => setModalOpen(false)}>Cancel</GhostBtn>
              <PrimaryBtn size="sm" onClick={saveNew} disabled={!draft.name.trim()}>
                <AdminIcon name="check" className="w-4 h-4"/>Save maid
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
  const order = { Available: 0, Busy: 1, "On-Leave": 2 };
  const staff = [...store.staff].sort((a,b) => order[a.status] - order[b.status]);

  const dateDow = dateKey ? new Date(dateKey + 'T00:00:00').getDay() : null;
  const isOffDay = (s) => {
    if (dateDow === null) return false;
    const days = s.working_days;
    return Array.isArray(days) && days.length > 0 && !days.includes(dateDow);
  };

  return (
    <Card padded={false} title="Daily Staff Schedule"
      subtitle={dateKey ? `Jobs and availability for ${new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}.` : "Pick a date above."}>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid sticky top-0 z-10 bg-white border-b border-ink-200/70"
               style={{ gridTemplateColumns: `64px repeat(${staff.length}, minmax(132px, 1fr))` }}>
            <div></div>
            {staff.map(s => {
              const off = isOffDay(s);
              return (
                <div key={s.id} className={`flex flex-col items-center gap-1.5 py-3 px-2 ${off ? 'opacity-50' : ''}`}>
                  <StaffAvatar s={s} size={44}/>
                  <div className="text-[12.5px] font-bold text-ink-900 truncate max-w-full">{s.name.split(" ")[0]}</div>
                  <div className={`flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-[0.12em] ${off ? 'text-ink-400' : 'text-mint-700 font-semibold'}`}>
                    {off
                      ? <span className="inline-block w-2 h-2 rounded-full bg-ink-300"/>
                      : <span className="inline-block w-2 h-2 rounded-full bg-mint-500"/>}
                    {off ? 'Off Today' : 'Working'}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="relative grid"
               style={{ gridTemplateColumns: `64px repeat(${staff.length}, minmax(132px, 1fr))`, gridAutoRows: `${cellH}px` }}>
            {SCHEDULE_HOURS.map((h, hi) => (
              <div key={`h${h}`} className="border-b border-r border-ink-200/70 text-[10.5px] font-mono text-ink-500 px-2 pt-1"
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
                {todays.filter(b => (store.assignments?.[b.ref] || []).includes(s.id)).map(b => {
                  const bookingStart = parseHour(b.time); if (bookingStart == null) return null;
                  // All maids work simultaneously — each starts at bookingStart for their full hours
                  const hoursMap = store.staffHours?.[b.ref] || {};
                  const myHours  = Number(hoursMap[s.id] ?? b.hours);
                  const start    = bookingStart;
                  const startIdx = Math.max(0, start - SCHEDULE_HOURS[0]);
                  const span     = Math.min(SCHEDULE_HOURS.length - startIdx, myHours);
                  if (span <= 0) return null;
                  const c    = STAFF_COLORS[s.color] || STAFF_COLORS.mint;
                  const endT = start + myHours;
                  return (
                    <div key={`${b.ref}-${s.id}`}
                      className={`relative m-1 rounded-lg ring-1 px-2.5 py-1.5 text-left overflow-hidden ${c.block}`}
                      style={{ gridColumn: sIdx + 2, gridRow: `${startIdx + 1} / span ${Math.max(1, Math.ceil(span))}` }}>
                      <div className="text-[10.5px] font-mono opacity-80">
                        {fmt12(Math.floor(start), Math.round((start % 1) * 60))} — {fmt12(Math.floor(endT), Math.round((endT % 1) * 60))}
                      </div>
                      <div className="text-[12.5px] font-bold leading-tight mt-0.5 truncate">{b.customer}</div>
                      <div className="text-[11px] opacity-80 truncate">{b.service}</div>
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
const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 5; // 5 AM to 10 PM
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { value: h, label: `${h12}:00 ${ap}` };
});

const SettingsSection = ({ store, set }) => {
  const brand = store.brand || { name:'Maid Pro', phone:'+974 4400 1188', currency:'QAR', timezone:'Asia/Qatar (GMT+3)', logo:'' }
  const rules = store.bookingRules || { autoConfirm:true, smsReminders:true, guestCheckout:false, idVerification:true, noShowFee:false, maidPhotos:true, autoAssign:true }
  const hours = store.businessHours || { open: 8, close: 19 }
  const setB = p => set({ brand: { ...brand, ...p } })
  const setR = p => set({ bookingRules: { ...rules, ...p } })
  const setH = p => set({ businessHours: { ...hours, ...p } })
  const [saved, setSaved] = React.useState(false)
  const save = async () => {
    setSaved(false)
    try {
      const { error } = await supabase.from('settings').upsert([
        { key:'brand', value:brand },
        { key:'bookingRules', value:rules },
        { key:'businessHours', value:hours },
      ])
      if (error) throw error
      broadcastSettingsUpdate()
      setSaved(true); setTimeout(()=>setSaved(false),3000)
    } catch(e) { alert('Save failed: ' + (e.message || 'Network error — check your connection.')) }
  }
  const RULES = [['autoConfirm','Auto-confirm bookings'],['smsReminders','Send SMS reminders'],['guestCheckout','Allow guest checkout'],['idVerification','Require ID verification'],['noShowFee','Charge no-show fee'],['maidPhotos','Show maid photos']]
  return (
    <div className="space-y-5 fade-up">
      <Card title="Brand Identity" subtitle="Company name, logo and contact details — shown in the sidebar and booking page.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Brand name</Label><TextField value={brand.name} onChange={v=>setB({name:v})} className="mt-2"/></div>
          <div><Label>Support phone</Label><TextField value={brand.phone} onChange={v=>setB({phone:v})} className="mt-2"/></div>
          <div className="md:col-span-2">
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
          <div><Label>Currency</Label><TextField value={brand.currency} onChange={v=>setB({currency:v})} className="mt-2"/></div>
          <div><Label>Time zone</Label><TextField value={brand.timezone} onChange={v=>setB({timezone:v})} className="mt-2"/></div>
        </div>
      </Card>
      <Card title="Booking Rules">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RULES.map(([key,label]) => (
            <div key={key} className="flex items-center justify-between rounded-lg hairline bg-white px-3 py-2.5">
              <span className="text-[13px] text-ink-800 font-medium">{label}</span>
              <Switch on={!!rules[key]} onChange={v => setR({ [key]: v })} ariaLabel={label}/>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Auto Assign" subtitle="Automatically route each new booking to the right maid — no manual picking needed.">
        <div className={`flex items-start sm:items-center justify-between gap-4 rounded-xl px-4 py-4 transition-all
          ${rules.autoAssign ? "bg-mint-50 ring-1 ring-mint-300" : "bg-ink-50 hairline"}`}>
          <div>
            <div className="text-[13.5px] font-semibold text-ink-900">Enable Auto Assign</div>
            <div className="text-[12px] text-ink-500 mt-0.5 max-w-sm">
              When on, every new booking is instantly assigned to the maid carrying the <span className="font-semibold">fewest active jobs</span>. Only maids whose <span className="font-semibold">working days</span> include the booking date are considered.
            </div>
          </div>
          <Switch on={!!rules.autoAssign} onChange={v => setR({ autoAssign: v })} ariaLabel="Auto Assign"/>
        </div>
        {rules.autoAssign && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-mint-700 font-medium">
            <AdminIcon name="check" className="w-3.5 h-3.5"/>
            Auto Assign is active — new bookings will be assigned automatically.
          </div>
        )}
      </Card>

      <Card title="Business Hours" subtitle="Set the opening and closing time for customer bookings. Slots outside these hours are hidden.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Opening time</Label>
            <select value={hours.open} onChange={e => setH({ open: Number(e.target.value) })}
              className="mt-2 w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
              {HOUR_OPTIONS.filter(o => o.value < hours.close).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Closing time</Label>
            <select value={hours.close} onChange={e => setH({ close: Number(e.target.value) })}
              className="mt-2 w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
              {HOUR_OPTIONS.filter(o => o.value > hours.open).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-ink-50 text-[12.5px] text-ink-600">
          <AdminIcon name="calendar" className="w-3.5 h-3.5 flex-shrink-0"/>
          Customers can book from <span className="font-semibold mx-1">{HOUR_OPTIONS.find(o=>o.value===hours.open)?.label}</span> to <span className="font-semibold mx-1">{HOUR_OPTIONS.find(o=>o.value===hours.close)?.label}</span> · {hours.close - hours.open} hour window
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3 border-t border-ink-200 mt-4 pt-4">
        {saved && <span className="flex items-center gap-1.5 text-[13px] font-semibold text-mint-700"><AdminIcon name="check" className="w-4 h-4"/>Saved!</span>}
        <PrimaryBtn onClick={save}><AdminIcon name="check" className="w-4 h-4"/>Save Changes</PrimaryBtn>
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
      revenue: bks.filter(b=>['Confirmed','Completed'].includes(b.status)).reduce((s,b)=>s+b.total,0) }
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
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">Revenue (QAR) last 14 days</div>
          <div className="text-[13px] font-bold text-ink-900 font-mono">{data.reduce((s,d)=>s+d.revenue,0).toLocaleString()} QAR</div>
        </div>
        <svg viewBox={'0 0 '+W+' '+(H+PY)} className="w-full" style={{overflow:'visible'}}>
          <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="oklch(0.72 0.13 168)" stopOpacity="0.25"/><stop offset="100%" stopColor="oklch(0.72 0.13 168)" stopOpacity="0"/></linearGradient></defs>
          {maxR>1&&<><path d={areaPath} fill="url(#revGrad)"/><path d={linePath} fill="none" stroke="oklch(0.62 0.13 168)" strokeWidth="2"/>{lp.map((p,i)=>data[i].revenue>0&&<circle key={i} cx={p.x} cy={p.y} r="3" fill="oklch(0.62 0.13 168)" stroke="#fff" strokeWidth="1.5"/>)}</>}
          {maxR<=1&&<text x={W/2} y={H/2} textAnchor="middle" fontSize="11" fill="#d1d5db">No confirmed revenue yet</text>}
          {data.map((d,i)=><text key={i} x={i*bw+bw/2} y={H+PY-1} textAnchor="middle" fontSize="8" fill="#9ca3af">{d.label}</text>)}
          <line x1="0" y1={H} x2={W} y2={H} stroke="#f3f4f6"/>
        </svg>
      </div>
    </div>
  )
}

/* --- Booking Detail Modal --- */
const BOOKING_STATUSES = ['New','Confirmed','Pending','In Progress','Completed','Cancelled']

const BookingDetailModal = ({ booking, store, set, onClose }) => {
  const [status, setStatus] = React.useState(
    BOOKING_STATUSES.includes(booking.status) ? booking.status : 'New'
  )
  const [notes, setNotes] = React.useState(booking._raw?.notes || '')
  // Keep as string so the user can freely type decimals (e.g. "10.50")
  const [paidAmount, setPaidAmount] = React.useState(
    String(booking._raw?.paid_amount ?? 0)
  )
  const [payMethod, setPayMethod] = React.useState(
    booking._raw?.payment_method || 'Cash'
  )
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const total = Number(booking.total) || 0
  const paidNum = parseFloat(paidAmount) || 0
  const due = Math.max(0, total - paidNum)

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
      await supabase.from('bookings').update({ staff_hours: updated }).eq('id', booking._raw.id)
  }
  const resetToFullHours = async () => {
    if (!assignedIds.length) return
    // Reset every maid back to the full booking duration (simultaneous work)
    const updated = Object.fromEntries(assignedIds.map(id => [id, totalBookingHours]))
    set({ staffHours: { ...(store.staffHours || {}), [booking.ref]: updated } })
    if (booking._raw?.id)
      await supabase.from('bookings').update({ staff_hours: updated }).eq('id', booking._raw.id)
  }

  const save = async () => {
    if (!booking._raw?.id) { setSaveError('Booking has no database ID — cannot save.'); return }
    setSaving(true)
    setSaveError('')
    const { error } = await supabase.from('bookings').update({
      status,
      notes,
      paid_amount:    paidNum,
      payment_method: payMethod,
      staff_hours:    store.staffHours?.[booking.ref] || {},
    }).eq('id', booking._raw.id)
    setSaving(false)
    if (!error) {
      onClose(true)
    } else {
      console.error('save booking error:', error)
      setSaveError(error.message || 'Failed to save. Check Supabase columns exist.')
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50" onClick={() => onClose(false)}/>
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl ring-1 ring-ink-200 p-6 space-y-4 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-mint-50 text-mint-700 grid place-items-center flex-shrink-0"><AdminIcon name="list" className="w-5 h-5"/></div>
          <div className="flex-1 min-w-0"><div className="font-bold text-ink-900 text-[16px] font-mono">{booking.ref}</div><div className="text-[12px] text-ink-500">{booking.date} {booking.time}</div></div>
          <button onClick={() => onClose(false)} className="w-8 h-8 grid place-items-center rounded-lg text-ink-500 hover:bg-ink-100"><AdminIcon name="x" className="w-4 h-4"/></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[['Customer',booking.customer],['Phone',booking.phone],['Service',booking.service],['Mode',booking.mode],['Maids x Hours',booking.maids+' x '+booking.hours+'h'],['Total','QAR '+booking.total.toLocaleString()]].map(([l,v])=>(
            <div key={l} className="p-3 rounded-xl bg-ink-50"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">{l}</div><div className="mt-0.5 text-[13px] font-medium text-ink-900 truncate">{v||'---'}</div></div>
          ))}
        </div>
        {booking._raw && booking._raw.address && (
          <div className="p-3 rounded-xl bg-ink-50"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 mb-0.5">Address</div><div className="text-[13px] text-ink-900">{booking._raw.address}</div></div>
        )}
        <div><Label className="mb-1.5">Status</Label><select value={status} onChange={e => setStatus(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none">{BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>

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

        {/* ── Staff Hours Editor ── */}
        {assignedIds.length > 0 && (
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
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-200">
          <GhostBtn onClick={() => onClose(false)}>Cancel</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving}><AdminIcon name="check" className="w-4 h-4"/>{saving ? 'Saving...' : 'Save changes'}</PrimaryBtn>
        </div>
      </div>
    </div>
  )
}

/* --- New Booking Modal --- */
const mkRef = async () => {
  const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
  return `MP-${String((count ?? 0) + 1).padStart(3, '0')}`;
};

const NewBookingModal = ({ store, onClose }) => {
  // Fetch all services fresh from Supabase so modal always has up-to-date list
  const [svcs, setSvcs] = React.useState((store.services||[]))
  React.useEffect(() => {
    supabase.from('settings').select('value').eq('key','services').maybeSingle()
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
  const [f, setF] = React.useState({ name:'', phone:'', service:defSvc, date:defDate, time:'9:00 AM', hours:3, cleaners:1, rate:15, total:45, address:'', notes:'', status:'New' })
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
    supabase.from('customers').select('*').order('name').then(({ data }) => setAllCustomers(data || []))
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
      supabase.from('bookings').select('time, hours, cleaners, assigned_staff').eq('date', f.date).neq('status', 'Cancelled'),
      supabase.from('staff').select('id, working_days'),
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
    setSaving(true); setErr('')

    // Auto-assign maids filtered by service mode + skill
    let assigned_staff = []
    try {
      const needed = Number(f.cleaners) || 1
      const mode   = 'hourly' // NewBookingModal always books hourly-style
      const { data: availStaff } = await supabase.from('staff').select('id, skills, working_days')
      if (availStaff && availStaff.length > 0) {
        // Filter by service mode — modes stored as "@hourly","@monthly","@stayin" inside skills
        let pool = availStaff.filter(s => {
          const sk = Array.isArray(s.skills) ? s.skills : []
          const modes = sk.filter(x => x.startsWith('@')).map(x => x.slice(1))
          return modes.length === 0 || modes.includes(mode)
        })
        // Filter by working day for the booking date
        if (f.date) pool = pool.filter(s => isWorkingDay(s, f.date))
        // Filter by skill if service matches a known skill ID
        const svcId = (store.services || []).find(s => s.name === f.service)?.id
        if (svcId) {
          const skilled = pool.filter(s => (Array.isArray(s.skills) ? s.skills : []).filter(x => !x.startsWith('@')).includes(svcId))
          if (skilled.length > 0) pool = skilled
        }
        if (pool.length > 0) {
          const { data: existingBks } = await supabase.from('bookings').select('assigned_staff').not('assigned_staff', 'is', null)
          const jobCounts = {}
          ;(existingBks || []).forEach(b => (b.assigned_staff || []).forEach(sid => { jobCounts[sid] = (jobCounts[sid] || 0) + 1 }))
          const sorted = [...pool].sort((a, b) => (jobCounts[a.id] || 0) - (jobCounts[b.id] || 0))
          assigned_staff = sorted.slice(0, needed).map(s => s.id)
        }
      }
    } catch (_) {}

    const ref = await mkRef()
    const { error } = await supabase.from('bookings').insert({ ref, name:f.name, phone:f.phone, service:f.service, date:f.date, time:f.time, hours:Number(f.hours), cleaners:Number(f.cleaners), rate:Number(f.rate), total:Number(f.total), address:f.address, notes:f.notes, status:f.status, materials:false, assigned_staff })
    if (error) { setErr(error.message); setSaving(false); return }
    if (!selectedCust && f.name.trim() && f.phone.trim()) {
      const custId = 'c_' + f.phone.replace(/\D/g,'').slice(-10) + '_' + Date.now()
      await supabase.from('customers').insert({ id: custId, name: f.name.trim(), phone: f.phone.trim(), address: f.address || '', area: '' }).then(() => {})
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
          <div><Label className="mb-1.5">Maids</Label><TextField type="number" value={f.cleaners} onChange={v=>upd({cleaners:v})} suffix="maids"/></div>
          <div><Label className="mb-1.5">Rate QAR/hr</Label><TextField type="number" value={f.rate} onChange={v=>upd({rate:v})} suffix="QAR"/></div>
          <div><Label className="mb-1.5">Total</Label><TextField type="number" value={f.total} onChange={v=>upd({total:v})} suffix="QAR"/></div>
          <div className="col-span-2"><Label className="mb-1.5">Status</Label><select value={f.status} onChange={e=>upd({status:e.target.value})} className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none">{['New','Confirmed','Pending'].map(s=><option key={s}>{s}</option>)}</select></div>
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
const ReportsSection = ({ bookings }) => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10);
  const todayStr = today.toISOString().slice(0,10);
  const [from, setFrom] = React.useState(firstOfMonth);
  const [to, setTo] = React.useState(todayStr);

  const inRange = bookings.filter(b => {
    const d = b._raw?.date || '';
    return d >= from && d <= to;
  });

  const confirmed = inRange.filter(b => ['Confirmed','Completed'].includes(b.status));
  const revenue = confirmed.reduce((s, b) => s + b.total, 0);
  const paidTotal = inRange.reduce((s, b) => s + (Number(b._raw?.paid_amount) || 0), 0);
  const dueTotal = inRange.reduce((s, b) => s + Math.max(0, b.total - (Number(b._raw?.paid_amount) || 0)), 0);
  const avgVal = confirmed.length > 0 ? (revenue / confirmed.length) : 0;

  const byService = {};
  inRange.forEach(b => {
    const svc = b.service || 'Unknown';
    if (!byService[svc]) byService[svc] = { count: 0, revenue: 0 };
    byService[svc].count += 1;
    if (['Confirmed','Completed'].includes(b.status)) byService[svc].revenue += b.total;
  });

  const byStatus = {};
  inRange.forEach(b => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });

  const cancelled = inRange.filter(b => b.status === 'Cancelled').length;
  const completed = inRange.filter(b => b.status === 'Completed').length;
  const cancRate = inRange.length > 0 ? ((cancelled / inRange.length) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-5 fade-up">
      {/* Date filter */}
      <Card title="Date Range Filter" subtitle="Filter all report metrics by booking date.">
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
          <div className="flex gap-2">
            {[
              { label: 'Today',     f: () => { setFrom(todayStr); setTo(todayStr); } },
              { label: 'This week', f: () => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); setFrom(d.toISOString().slice(0,10)); setTo(todayStr); } },
              { label: 'This month',f: () => { setFrom(firstOfMonth); setTo(todayStr); } },
              { label: 'All time',  f: () => { setFrom('2020-01-01'); setTo(todayStr); } },
            ].map(p => (
              <button key={p.label} onClick={p.f}
                className="h-10 px-3 rounded-lg hairline text-[12.5px] font-semibold text-ink-700 hover:bg-ink-100 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 text-[12.5px] text-ink-500">
          Showing <span className="font-bold text-ink-900">{inRange.length}</span> bookings from <span className="font-mono">{from}</span> to <span className="font-mono">{to}</span>
        </div>
      </Card>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Bookings',    value: inRange.length,               unit: '',     icon: 'list',     tone: 'ink'  },
          { label: 'Confirmed Revenue', value: revenue.toLocaleString(),      unit: 'QAR',  icon: 'money',    tone: 'mint' },
          { label: 'Amount Collected',  value: paidTotal.toLocaleString(),    unit: 'QAR',  icon: 'check',    tone: 'mint' },
          { label: 'Outstanding Due',   value: dueTotal.toLocaleString(),     unit: 'QAR',  icon: 'trend',    tone: 'ink'  },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl2 hairline shadow-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">{k.label}</span>
              <span className={`w-8 h-8 grid place-items-center rounded-lg ${k.tone === 'mint' ? 'bg-mint-100 text-mint-700' : 'bg-ink-100 text-ink-700'}`}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By service */}
        <Card title="Revenue by Service" subtitle="Breakdown of confirmed + completed bookings.">
          {Object.keys(byService).length === 0 ? (
            <div className="text-[13px] text-ink-400 py-4 text-center">No bookings in selected range.</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(byService).sort((a,b) => b[1].revenue - a[1].revenue).map(([svc, d]) => {
                const pct = revenue > 0 ? (d.revenue / revenue) * 100 : 0;
                return (
                  <div key={svc}>
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="font-medium text-ink-800 truncate">{svc}</span>
                      <span className="font-mono tabular-nums text-ink-700 ml-3 flex-shrink-0">{d.count} jobs · QAR {d.revenue.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                      <div className="h-full bg-mint-500 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* By status */}
        <Card title="Bookings by Status" subtitle="Status distribution for the selected period.">
          {Object.keys(byStatus).length === 0 ? (
            <div className="text-[13px] text-ink-400 py-4 text-center">No bookings in selected range.</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(byStatus).sort((a,b) => b[1] - a[1]).map(([st, cnt]) => {
                const pct = inRange.length > 0 ? (cnt / inRange.length) * 100 : 0;
                const color = { Completed: 'bg-mint-500', Confirmed: 'bg-sky-500', New: 'bg-amber-500', Cancelled: 'bg-red-400', Pending: 'bg-violet-400', 'In Progress': 'bg-blue-400' }[st] || 'bg-ink-400';
                return (
                  <div key={st}>
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="font-medium text-ink-800">{st}</span>
                      <span className="font-mono tabular-nums text-ink-600">{cnt} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-ink-100 grid grid-cols-2 gap-2 text-[12.5px] text-ink-600">
                <span>Completed: <span className="font-bold text-mint-700">{completed}</span></span>
                <span>Cancellation rate: <span className="font-bold text-red-600">{cancRate}%</span></span>
                <span>Avg booking: <span className="font-bold text-ink-900">QAR {Math.round(avgVal).toLocaleString()}</span></span>
                <span>Total collected: <span className="font-bold text-mint-700">QAR {paidTotal.toLocaleString()}</span></span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Booking list for range */}
      <Card title="Bookings in Range" subtitle="All bookings within the selected date range." padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 bg-ink-50/40">
                <th className="px-5 py-3">Ref</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Service</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {inRange.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-[13px] text-ink-400">No bookings in selected range.</td></tr>
              ) : inRange.map(b => {
                const paid = Number(b._raw?.paid_amount) || 0;
                const due = Math.max(0, b.total - paid);
                return (
                  <tr key={b.ref} className="border-t border-ink-200/70 hover:bg-ink-50/50">
                    <td className="px-5 py-3 font-mono text-[12.5px] text-ink-600">{b.ref}</td>
                    <td className="px-3 py-3 text-[13px] font-semibold text-ink-900">{b.customer}</td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-600">{b.service}</td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-600">{b.date}</td>
                    <td className="px-3 py-3"><StatusPill status={b.status}/></td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[13px] text-ink-700">{b.total.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[13px] text-mint-700">{paid.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-[13px] font-bold" style={{color: due>0?'#dc2626':'#16a34a'}}>{due.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

/* ─── Admin Login ─── */
const LoginScreen = ({ onLogin }) => {
  const [user, setUser] = React.useState('');
  const [pass, setPass] = React.useState('');
  const [err, setErr] = React.useState('');
  const submit = (e) => {
    e.preventDefault();
    if (user.trim() === 'admin' && pass === 'admin') {
      try { localStorage.setItem('mp_admin_auth', '1'); } catch(_) {}
      onLogin();
    } else {
      setErr('Invalid username or password.');
    }
  };
  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-float p-8 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-mint-500 grid place-items-center mx-auto shadow-mint mb-4">
            <AdminIcon name="sparkle" className="w-7 h-7 text-ink-900" strokeWidth={2.2}/>
          </div>
          <h1 className="text-[22px] font-extrabold text-ink-900 tracking-tight">Maid Pro Admin</h1>
          <p className="text-[13px] text-ink-500 mt-1">Sign in to your admin panel</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Username</label>
            <div className="relative">
              <AdminIcon name="contact" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"/>
              <input type="text" value={user} onChange={e => setUser(e.target.value)} placeholder="admin"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-white hairline text-[14px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
            </div>
          </div>
          <div>
            <label className="block text-[11.5px] font-bold text-ink-600 uppercase tracking-[0.1em] mb-1">Password</label>
            <div className="relative">
              <AdminIcon name="settings" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"/>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-white hairline text-[14px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
            </div>
          </div>
          {err && <div className="text-[12.5px] text-red-600 font-medium">{err}</div>}
          <button type="submit"
            className="w-full h-11 rounded-xl bg-mint-500 hover:bg-mint-400 active:bg-mint-600 text-ink-900 font-bold text-[14px] shadow-mint transition-colors mt-1">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
};

const App = () => {
  const [authed, setAuthed] = React.useState(() => {
    try { return localStorage.getItem('mp_admin_auth') === '1'; } catch(_) { return false; }
  });
  const [section, setSection] = React.useState("overview");
  const [payFilter, setPayFilter] = React.useState("All");
  const [store, setStore] = React.useState(initialStore());
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [globalSearch, setGlobalSearch] = React.useState('');
  const [dbStatus, setDbStatus] = React.useState('checking'); // 'checking' | 'ok' | 'error'
  const [dbError, setDbError] = React.useState('');

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;
  const set = (p) => setStore(prev => { const patch = typeof p === 'function' ? p(prev) : p; return { ...prev, ...patch }; });

  /* Connection health-check — runs once on mount and on manual retry */
  const checkConnection = React.useCallback(async () => {
    setDbStatus('checking');
    try {
      const { error } = await supabase.from('settings').select('key').limit(1);
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
    const { data: rows, error: fetchErr } = await supabase.from('bookings').select('id');
    if (fetchErr) { alert('Could not read bookings: ' + fetchErr.message); return; }

    if (rows && rows.length > 0) {
      const ids = rows.map(r => r.id);
      const { error: delErr } = await supabase.from('bookings').delete().in('id', ids);
      if (delErr) { alert('Delete failed: ' + delErr.message); return; }
    }

    /* Step 2 — verify Supabase actually removed the rows */
    const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
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
    const { data: custRows } = await supabase.from('customers').select('id');
    if (custRows && custRows.length > 0) {
      await supabase.from('customers').delete().in('id', custRows.map(r => r.id));
    }

    setBookings([]);
    // Only reset booking-related store state — preserve staff, settings, services, nationalities, etc.
    setStore(prev => ({ ...prev, assignments: {}, staffHours: {} }));
  };

  React.useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('settings').select('*');
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

  const fetchBookings = React.useCallback(async () => {
    const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(500);
    if (!error && data) {
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
    const { data: settingsRows } = await supabase.from('settings').select('key,value').eq('key', 'bookingRules').maybeSingle();
    const autoAssign = settingsRows?.value?.autoAssign ?? true; // default true if not saved yet
    if (!autoAssign) return;

    // Skip if this booking is already assigned
    const { data: bkRow } = await supabase.from('bookings').select('assigned_staff').eq('id', newRow.id).maybeSingle();
    if (bkRow?.assigned_staff?.length > 0) return;

    // Get all staff — availability is determined solely by working_days, not status
    const { data: availableStaff } = await supabase.from('staff').select('id, skills, working_days');
    if (!availableStaff || availableStaff.length === 0) return;

    // Filter by booking mode (look for @mode prefix in skills array)
    const mode = newRow.mode || 'hourly';
    let pool = availableStaff.filter(s => {
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
      const { data: svcSettings } = await supabase.from('settings').select('value').eq('key','services').maybeSingle();
      const svcId = (svcSettings?.value || []).find(s => s.name === newRow.service)?.id;
      if (svcId) {
        const skilled = pool.filter(s => (Array.isArray(s.skills) ? s.skills : []).filter(x => !x.startsWith('@')).includes(svcId));
        if (skilled.length > 0) pool = skilled;
      }
    }

    if (pool.length === 0) return;

    // Count active jobs per maid
    const { data: allBookings } = await supabase.from('bookings').select('assigned_staff').not('assigned_staff', 'is', null);
    const jobCounts = {};
    (allBookings || []).forEach(b => (b.assigned_staff || []).forEach(sid => { jobCounts[sid] = (jobCounts[sid] || 0) + 1; }));

    // Pick the N least-busy maids
    const needed = Math.max(1, Number(newRow.cleaners) || 1);
    const sorted = [...pool].sort((a, b) => (jobCounts[a.id] || 0) - (jobCounts[b.id] || 0));
    const assigned = sorted.slice(0, needed).map(s => s.id);
    const ref = newRow.ref || String(newRow.id);

    await supabase.from('bookings').update({ assigned_staff: assigned }).eq('id', newRow.id);
    setStore(prev => ({ ...prev, assignments: { ...(prev.assignments || {}), [ref]: assigned } }));
    fetchBookings();
  }, [fetchBookings]);

  React.useEffect(() => {
    fetchBookings();

    // Realtime — instant when Supabase Realtime is enabled for the bookings table
    const ch = supabase.channel('admin-bookings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        fetchBookings();
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
    const { data, error } = await supabase.from('nationalities').select('*').order('name');
    if (!error && data) {
      setStore(prev => ({ ...prev, nationalities: data.map(n => ({
        id: n.id, name: n.name, flag: toFlag(n.flag || '🌍'),
        rate: Number(n.rate) || 15, on: n.enabled !== false,
      })) }));
    }
  }, []);

  /* ── Live staff from Supabase ── */
  const fetchStaff = React.useCallback(async () => {
    const { data, error } = await supabase.from('staff').select('*').order('name');
    if (!error && data && data.length > 0) {
      setStore(prev => ({ ...prev, staff: data.map(s => ({
        id: s.id, name: s.name || '',
        nationality: s.nationality || 'philippines',
        status: s.status || 'Available',
        color: s.color || 'mint',
        // Service modes are stored as "@hourly","@monthly","@stayin" inside the skills array
        skills:        (Array.isArray(s.skills) ? s.skills : []).filter(sk => !sk.startsWith('@')),
        serviceTypes:  (Array.isArray(s.skills) ? s.skills : []).filter(sk => sk.startsWith('@')).map(sk => sk.slice(1)),
        phone: s.phone || '',
        notes: s.notes || '',
        working_days: Array.isArray(s.working_days) ? s.working_days : [0,1,2,3,4,5,6],
      })) }));
    }
  }, []);

  React.useEffect(() => {
    fetchNationalities();
    fetchStaff();
    const ch2 = supabase
      .channel('admin-nat-staff-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nationalities' }, fetchNationalities)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, fetchStaff)
      .subscribe();
    return () => supabase.removeChannel(ch2);
  }, [fetchNationalities, fetchStaff]);

  const todayISO  = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const todayBks  = bookings.filter(b => b._raw && b._raw.date === todayISO);
  const mtdRev    = bookings.filter(b => ['Confirmed','Completed'].includes(b.status) && (b._raw && b._raw.created_at || '').startsWith(thisMonth)).reduce((s, b) => s + b.total, 0);
  const activeMaids = todayBks.filter(b => b.status === 'Confirmed').reduce((s, b) => s + b.maids, 0);
  const doneCount = bookings.filter(b => b.status === 'Completed').length;
  const doneOf    = bookings.filter(b => ['Confirmed','Completed','Cancelled'].includes(b.status)).length;
  const compRate  = doneOf > 0 ? ((doneCount / doneOf) * 100).toFixed(1) : "0";
  const pendingPayBks   = bookings.filter(b => b.payment_status === 'Pending' && b.status !== 'Cancelled');
  const pendingPayTotal = pendingPayBks.reduce((s, b) => s + Math.max(0, b.total - b.paid_amount), 0);
  const dynamicKpis = [
    { label: "Bookings Today",    value: String(todayBks.length),       unit: "jobs", delta: 0, icon: "calendar", tone: "mint" },
    { label: "Active Maids",      value: String(activeMaids || 0),      unit: "live", delta: 0, icon: "users",    tone: "ink"  },
    { label: "Revenue (MTD)",     value: mtdRev.toLocaleString(),        unit: "QAR",  delta: 0, icon: "money",    tone: "mint" },
    { label: "Completion Rate",   value: compRate,                       unit: "%",    delta: 0, icon: "trend",    tone: "ink"  },
    {
      label: "Pending Payments",
      value: String(pendingPayBks.length),
      unit:  "bookings",
      sub:   `QAR ${pendingPayTotal.toLocaleString()} due`,
      icon:  "money",
      tone:  "warn",
      onClick: () => { setSection('bookings'); setPayFilter('Pending'); },
    },
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
    reports:       <ReportsSection bookings={bookings}/>
  };

  return (
    <div className="flex flex-row min-h-screen bg-ink-50" data-screen-label="01 Admin Dashboard">
      {/* Desktop sidebar — fixed width column, never shrinks */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <Sidebar active={section} onNav={setSection} bookingsCount={bookings.length} brand={store.brand}/>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setDrawerOpen(false)}></div>
          <div className="relative animate-[fadeUp_.2s_ease]">
            <Sidebar active={section} onNav={setSection} onClose={() => setDrawerOpen(false)} mobile bookingsCount={bookings.length} brand={store.brand}/>
          </div>
        </div>
      )}

      {/* Main content — fills remaining width, never underlaps sidebar */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <TopBar section={section} onMenu={() => setDrawerOpen(true)} store={store} onClear={clearAll} searchQuery={globalSearch} onSearch={setGlobalSearch} bookings={bookings}/>

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

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1480px] w-full mx-auto">
          {sections[section]}
        </main>
        <footer className="px-4 sm:px-6 lg:px-8 py-5 text-[11.5px] font-mono uppercase tracking-[0.14em] text-ink-500 flex items-center justify-between border-t border-ink-200/70">
          <span>© Maid Pro Admin · 2026</span>
          <span>v2.4.0 · Build 18a3f</span>
        </footer>
      </div>
    </div>
  );
};

export default App;


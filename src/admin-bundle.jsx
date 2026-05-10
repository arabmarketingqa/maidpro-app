import React from 'react'
import { supabase, fmtBooking } from './supabase'

/* Admin UI primitives â€” exposed on window for cross-script access */

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
    {hint && <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-400 text-[11.5px]">Â· {hint}</span>}
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

/* Admin sections: Services, Nationalities, Packages, Materials, Operations, Bookings */

/* â”€â”€â”€â”€â”€â”€â”€ Per-mode helpers â”€â”€â”€â”€â”€â”€â”€ */
const ModeHeaderCard = ({ mode, store, set }) => {
  const m = store.modes.find(x => x.id === mode);
  if (!m) return null;
  const updateMode = (id, on) => set({ modes: store.modes.map(x => x.id === id ? { ...x, on } : x) });
  return (
    <Card>
      <div className={`rounded-xl p-4 transition-colors ${m.on ? "bg-mint-50 hairline" : "bg-ink-50 hairline"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[20px]">{m.emoji}</span>
              <h4 className="font-bold text-ink-900 text-[15px]">{m.name}</h4>
              <Pill tone={m.on ? "mint" : "ink"}>
                <span className={`w-1.5 h-1.5 rounded-full ${m.on ? "bg-mint-500" : "bg-ink-400"}`}></span>
                {m.on ? "LIVE" : "DISABLED"}
              </Pill>
            </div>
            <p className="mt-1 text-[12.5px] text-ink-500 leading-snug">{m.desc}</p>
          </div>
          <Switch on={m.on} onChange={v => updateMode(m.id, v)} ariaLabel={`Toggle ${m.name}`} />
        </div>
        <div className="mt-3 pt-3 border-t border-ink-200/70 flex items-center justify-between text-[11.5px] text-ink-500">
          <span className="font-mono">{m.bookings} active bookings</span>
          <span>Toggling off hides it from the customer app.</span>
        </div>
      </div>
    </Card>
  );
};

/* â”€â”€â”€â”€â”€â”€â”€ Hourly Booking â”€â”€â”€â”€â”€â”€â”€ */
const HourlySection = ({ store, set }) => {
  const updateService = (id, patch) => set({ services: store.services.map(s => s.id === id ? { ...s, ...patch } : s) });
  const removeService = (id) => set({ services: store.services.filter(s => s.id !== id) });
  const addService = () => set({ services: [...store.services, { id: `sv${Date.now()}`, name: "New service", emoji: "ðŸ§½", rate: 15, on: true }] });

  return (
    <div className="space-y-5 fade-up">
      <ModeHeaderCard mode="hourly" store={store} set={set}/>

      <Card title="Hourly Service Types" subtitle="Cleaning categories shown on the customer app, with per-hour pricing."
        action={<PrimaryBtn size="sm" onClick={addService}><AdminIcon name="plus" className="w-4 h-4"/>Add service</PrimaryBtn>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {store.services.map(s => (
            <div key={s.id} className="rounded-xl hairline bg-white p-4">
              <div className="flex items-start gap-3">
                <input value={s.emoji} onChange={e => updateService(s.id, { emoji: e.target.value })}
                  className="w-12 h-12 text-center text-[26px] rounded-lg hairline bg-ink-50 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
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
    </div>
  );
};

/* â”€â”€â”€â”€â”€â”€â”€ Monthly Plans â”€â”€â”€â”€â”€â”€â”€ */
const MonthlySection = ({ store, set }) => {
  const ms = store.monthlySettings || { autoRenew: true, noticeDays: 14, minMonths: 1, allowSkip: true, freeReschedule: 2 };
  const setMs = (patch) => set({ monthlySettings: { ...ms, ...patch } });
  const updMonthly = (id, patch) => set({ monthly: store.monthly.map(p => p.id === id ? { ...p, ...patch } : p) });
  const removeMonthly = id => set({ monthly: store.monthly.filter(p => p.id !== id) });
  const addMonthly = () => set({ monthly: [...store.monthly, { id: `pkg${Date.now()}`, name: "New Package", emoji: "ðŸ“¦", maids: 1, daysPerWeek: 4, hoursPerDay: 4, priceMonthly: 1000, discountLabel: "" }] });

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
                  <input value={p.emoji} onChange={e => updMonthly(p.id, { emoji: e.target.value })}
                    className="w-12 h-12 text-center text-[24px] rounded-lg hairline bg-ink-50 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
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
    </div>
  );
};

/* â”€â”€â”€â”€â”€â”€â”€ Stay-In â”€â”€â”€â”€â”€â”€â”€ */
const StayInSection = ({ store, set }) => {
  const sis = store.stayinSettings || { visa: true, accommodation: true, food: true, deposit: 1, probationDays: 14, replaceWindow: 30 };
  const setSis = (patch) => set({ stayinSettings: { ...sis, ...patch } });
  const updStay = (id, patch) => set({ stayIn: store.stayIn.map(p => p.id === id ? { ...p, ...patch } : p) });
  const removeStay = id => set({ stayIn: store.stayIn.filter(p => p.id !== id) });
  const addStay = () => set({ stayIn: [...store.stayIn, { id: `si${Date.now()}`, name: "New", months: 1, price: 5000, save: 0, notes: "" }] });

  return (
    <div className="space-y-5 fade-up">
      <ModeHeaderCard mode="stayin" store={store} set={set}/>

      <Card
        title="Stay-In Plans"
        subtitle="Long-term live-in packages â€” set duration, total price, savings and customer-facing notes."
        action={<PrimaryBtn size="sm" onClick={addStay}><AdminIcon name="plus" className="w-4 h-4"/>New plan</PrimaryBtn>}
        padded={false}
      >
        <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_2fr_64px] gap-3 px-6 py-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-200/70 bg-ink-50/50">
          <div>Plan name</div><div>Months</div><div>Price</div><div>Savings</div><div>Notes</div><div></div>
        </div>
        <ul>
          {store.stayIn.map((p, i) => (
            <li key={p.id} className={`px-4 sm:px-6 py-3 ${i ? "border-t border-ink-200/70" : ""}`}>
              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1fr_0.8fr_2fr_64px] gap-3 items-start">
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
    </div>
  );
};

/* â”€â”€â”€â”€â”€â”€â”€ Services & Operations (legacy combined) â”€â”€â”€â”€â”€â”€â”€ */
const ServicesSection = ({ store, set }) => {
  const updateMode = (id, on) => set({ modes: store.modes.map(m => m.id === id ? { ...m, on } : m) });
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

/* â”€â”€â”€â”€â”€â”€â”€ Nationalities â”€â”€â”€â”€â”€â”€â”€ */
const NationalitiesSection = ({ store, set }) => {
  const update = (id, patch) => set({ nationalities: store.nationalities.map(n => n.id === id ? { ...n, ...patch } : n) });
  const remove = (id) => set({ nationalities: store.nationalities.filter(n => n.id !== id) });
  const add = () => set({
    nationalities: [
      ...store.nationalities,
      { id: `new${Date.now()}`, name: "New nationality", flag: "ðŸŒ", rate: 20, on: true }
    ]
  });

  return (
    <div className="space-y-5 fade-up">
      <Card
        title="Nationality Manager"
        subtitle="Add, edit, or disable maid nationalities and their per-hour base rates."
        action={
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[12px] text-ink-600">
              <span className="font-medium">Block</span>
              <Switch
                on={store.nationalitiesEnabled}
                onChange={v => set({ nationalitiesEnabled: v })}
                ariaLabel="Toggle nationality block"
              />
              <span className={`font-mono text-[11px] ${store.nationalitiesEnabled ? "text-mint-700" : "text-ink-500"}`}>
                {store.nationalitiesEnabled ? "ON" : "OFF"}
              </span>
            </div>
            <PrimaryBtn size="sm" onClick={add}><AdminIcon name="plus" className="w-4 h-4"/>Add</PrimaryBtn>
          </div>
        }
        padded={false}
      >
        <div className={store.nationalitiesEnabled ? "" : "opacity-60"}>
          {/* table header */}
          <div className="hidden md:grid grid-cols-[1.6fr_1fr_120px_64px] gap-3 px-6 py-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-200/70 bg-ink-50/50">
            <div>Name</div>
            <div>Base Rate</div>
            <div>Active</div>
            <div></div>
          </div>
          <ul>
            {store.nationalities.map((n, i) => (
              <li key={n.id} className={`row-hover px-4 sm:px-6 py-3 ${i ? "border-t border-ink-200/70" : ""}`}>
                <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_120px_64px] gap-3 items-center">
                  <div className="md:contents space-y-2 md:space-y-0">
                    <TextField value={n.name} onChange={v => update(n.id, { name: v })} placeholder="Country name" />
                    <TextField type="number" value={n.rate} onChange={v => update(n.id, { rate: v })} suffix="QAR/hr" />
                    <div className="flex items-center justify-between md:justify-start gap-3 rounded-lg md:rounded-none md:bg-transparent bg-ink-50 md:px-0 px-3 md:py-0 py-2 md:hairline-none hairline md:shadow-none">
                      <span className="md:hidden text-[12px] text-ink-600 font-medium">Active</span>
                      <Switch on={n.on} onChange={v => update(n.id, { on: v })} ariaLabel={`Toggle ${n.name}`} />
                    </div>
                    <div className="flex items-center justify-end md:justify-start gap-1">
                      <IconBtn icon="trash" tone="danger" onClick={() => remove(n.id)} title="Delete" />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
};

/* â”€â”€â”€â”€â”€â”€â”€ Packages (Monthly + Stay-In) â”€â”€â”€â”€â”€â”€â”€ */
const PackagesSection = ({ store, set }) => {
  const updMonthly = (id, patch) => set({ monthly: store.monthly.map(p => p.id === id ? { ...p, ...patch } : p) });
  const removeMonthly = id => set({ monthly: store.monthly.filter(p => p.id !== id) });
  const addMonthly = () => set({
    monthly: [...store.monthly, { id: `pkg${Date.now()}`, name: "New Package", emoji: "ðŸ“¦", maids: 1, daysPerWeek: 4, hoursPerDay: 4, priceMonthly: 1000, discountLabel: "" }]
  });

  const updStay = (id, patch) => set({ stayIn: store.stayIn.map(p => p.id === id ? { ...p, ...patch } : p) });
  const removeStay = id => set({ stayIn: store.stayIn.filter(p => p.id !== id) });
  const addStay = () => set({
    stayIn: [...store.stayIn, { id: `si${Date.now()}`, name: "New", months: 1, price: 5000, save: 0, notes: "" }]
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
                  <input value={p.emoji} onChange={e => updMonthly(p.id, { emoji: e.target.value })}
                    className="w-12 h-12 text-center text-[24px] rounded-lg hairline bg-ink-50 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"/>
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
        subtitle="Long-term live-in packages â€” set duration, total price, savings and customer-facing notes."
        action={<PrimaryBtn size="sm" onClick={addStay}><AdminIcon name="plus" className="w-4 h-4"/>New plan</PrimaryBtn>}
        padded={false}
      >
        <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_2fr_64px] gap-3 px-6 py-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-200/70 bg-ink-50/50">
          <div>Plan name</div><div>Months</div><div>Price</div><div>Savings</div><div>Notes</div><div></div>
        </div>
        <ul>
          {store.stayIn.map((p, i) => (
            <li key={p.id} className={`px-4 sm:px-6 py-3 ${i ? "border-t border-ink-200/70" : ""}`}>
              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1fr_0.8fr_2fr_64px] gap-3 items-start">
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

/* â”€â”€â”€â”€â”€â”€â”€ Materials & Add-ons â”€â”€â”€â”€â”€â”€â”€ */
const MaterialsSection = ({ store, set }) => {
  const updItem = (i, v) => {
    const next = [...store.materialsList]; next[i] = v;
    set({ materialsList: next });
  };
  const removeItem = i => set({ materialsList: store.materialsList.filter((_, j) => j !== i) });
  const addItem = () => set({ materialsList: [...store.materialsList, "New item"] });

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
    </div>
  );
};

/* â”€â”€â”€ Assign-staff dropdown for booking rows â”€â”€â”€ */
const AssignStaff = ({ booking, store, set }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const assigned = (store?.assignments?.[booking.ref]) || [];
  const toggle = (id) => {
    const has = assigned.includes(id);
    const next = has ? assigned.filter(x => x !== id) : [...assigned, id];
    set({ assignments: { ...(store.assignments || {}), [booking.ref]: next } });
  };
  const assignedStaff = assigned.map(id => store.staff.find(s => s.id === id)).filter(Boolean);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
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
        <div className="absolute top-full mt-1 right-0 z-30 w-64 rounded-xl bg-white shadow-lg ring-1 ring-ink-200 p-1.5 max-h-72 overflow-y-auto">
          <div className="px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">Assign maids</div>
          {store.staff.map(s => {
            const on = assigned.includes(s.id);
            const off = s.status === "On-Leave";
            return (
              <button key={s.id} onClick={() => !off && toggle(s.id)} disabled={off}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-[12.5px] ${off ? "opacity-40 cursor-not-allowed" : "hover:bg-ink-50"} ${on ? "bg-mint-50" : ""}`}>
                <StaffAvatar s={s} size={26}/>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-900 truncate">{s.name}</div>
                  <div className="flex items-center gap-1 text-[10.5px] text-ink-500"><StatusDot status={s.status}/>{s.status}</div>
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

/* â”€â”€â”€â”€â”€â”€â”€ Bookings table â”€â”€â”€â”€â”€â”€â”€ */
const BookingsSection = ({ bookings, store, set }) => {
  const [filter, setFilter] = React.useState("All");
  const [query, setQuery] = React.useState("");

  const filtered = bookings.filter(b =>
    (filter === "All" || b.status === filter) &&
    (!query || b.customer.toLowerCase().includes(query.toLowerCase()) || b.ref.toLowerCase().includes(query.toLowerCase()))
  );

  const filters = ["All", "Confirmed", "Pending", "In Progress", "Completed", "Cancelled"];

  return (
    <Card
      title={`Bookings Â· ${filtered.length}`}
      subtitle="Recent jobs across all service modes. Click a row to inspect."
      padded={false}
      action={
        <div className="flex items-center gap-2">
          <GhostBtn size="sm"><AdminIcon name="download" className="w-4 h-4"/>Export</GhostBtn>
          <PrimaryBtn size="sm"><AdminIcon name="plus" className="w-4 h-4"/>New booking</PrimaryBtn>
        </div>
      }
    >
      {/* filter bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-ink-200/70 flex flex-col sm:flex-row sm:items-center gap-3">
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
          <TextField icon="search" value={query} onChange={setQuery} placeholder="Search ref or customerâ€¦"/>
        </div>
      </div>

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
                <td className="px-3 py-3.5 text-[13px] font-mono tabular-nums text-ink-700">{b.maids} Ã— {b.hours}h</td>
                <td className="px-3 py-3.5"><AssignStaff booking={b} store={store} set={set}/></td>
                <td className="px-3 py-3.5"><StatusPill status={b.status}/></td>
                <td className="px-3 py-3.5 text-right">
                  <span className="font-mono tabular-nums text-[13.5px] font-semibold text-ink-900">
                    <span className="text-ink-500 mr-1 text-[10px]">QAR</span>{b.total.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-3.5">
                  <IconBtn icon="chevron"/>
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
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-[12px] text-ink-500">{b.ref}</span>
                  <StatusPill status={b.status}/>
                </div>
                <div className="mt-1 text-[14.5px] font-bold text-ink-900 truncate">{b.customer}</div>
                <div className="text-[12px] text-ink-500">{b.service} Â· {b.date}</div>
              </div>
              <div className="text-right">
                <div className="font-mono tabular-nums text-[14px] font-semibold text-ink-900">
                  <span className="text-ink-500 mr-1 text-[10px]">QAR</span>{b.total.toLocaleString()}
                </div>
                <div className="text-[11.5px] font-mono text-ink-500 mt-0.5">{b.maids}Ã—{b.hours}h</div>
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
  );
};

/* â”€â”€â”€â”€â”€â”€â”€ Overview KPI tiles â”€â”€â”€â”€â”€â”€â”€ */
const OverviewSection = ({ store, kpis, bookings }) => (
  <div className="space-y-5 fade-up">
    {/* KPI tiles */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {kpis.map(k => (
        <div key={k.label} className="bg-white rounded-xl2 hairline shadow-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">{k.label}</span>
            <span className={`w-8 h-8 grid place-items-center rounded-lg ${k.tone === "mint" ? "bg-mint-100 text-mint-700" : "bg-ink-100 text-ink-700"}`}>
              <AdminIcon name={k.icon} className="w-4 h-4"/>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[26px] sm:text-[30px] leading-none font-bold tracking-tight text-ink-900 tabular-nums">{k.value}</span>
            {k.unit && <span className="text-[12px] font-mono text-ink-500">{k.unit}</span>}
          </div>
          <div className={`mt-2 text-[11.5px] font-medium flex items-center gap-1 ${k.delta >= 0 ? "text-mint-700" : "text-red-600"}`}>
            <AdminIcon name={k.delta >= 0 ? "arrow-up" : "arrow-down"} className="w-3 h-3" strokeWidth={2.2}/>
            {Math.abs(k.delta)}% vs last week
          </div>
        </div>
      ))}
    </div>

    {/* Booking table */}
    <BookingsSection bookings={bookings.slice(0, 8)}/>

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


/* Admin app â€” sidebar shell, routing, seed data (root) */

const NAV = [
  { id: "overview",     label: "Overview",     icon: "grid" },
  { id: "bookings",     label: "Bookings",     icon: "list" },
  { id: "calendar",     label: "Calendar View", icon: "calendar" },
  { id: "staff",        label: "Staff Management", icon: "users" },
  { id: "hourly",       label: "Hourly Booking", icon: "broom" },
  { id: "monthly",      label: "Monthly Plans",  icon: "package" },
  { id: "stayin",       label: "Stay-In",        icon: "home" },
  { id: "nationalities",label: "Nationalities",  icon: "globe" },
  { id: "materials",    label: "Materials",    icon: "spray" },
  { id: "settings",     label: "Settings",     icon: "settings" },
];

/* Bookings loaded live from Supabase */

/* KPIs calculated from real bookings */

const initialStore = () => ({
  modes: [
    { id: "hourly",  name: "Hourly Booking",  emoji: "â±ï¸", desc: "On-demand cleaning, billed by the hour.",  bookings: 31, on: true },
    { id: "monthly", name: "Monthly Plans",   emoji: "ðŸ“…", desc: "Recurring weekly cleaning packages.",       bookings: 12, on: true },
    { id: "stayin",  name: "Stay-In",         emoji: "ðŸ ", desc: "Long-term live-in maid contracts.",         bookings: 4,  on: true },
  ],
  services: [
    { id: "regular", name: "Regular Cleaning",   emoji: "ðŸ§¹", rate: 15, on: true },
    { id: "deep",    name: "Deep Cleaning",      emoji: "âœ¨", rate: 18, on: true },
    { id: "movein",  name: "Move-in / Out",      emoji: "ðŸ“¦", rate: 20, on: true },
    { id: "post",    name: "Post-Construction", emoji: "ðŸ—ï¸", rate: 25, on: false },
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
  nationalities: [
    { id: "philippines", name: "Philippines", flag: "ðŸ‡µðŸ‡­", rate: 40, on: true },
    { id: "indian",      name: "Indian",      flag: "ðŸ‡®ðŸ‡³", rate: 25, on: true },
    { id: "nepal",       name: "Nepal",       flag: "ðŸ‡³ðŸ‡µ", rate: 20, on: true },
    { id: "nigeria",     name: "Nigeria",     flag: "ðŸ‡³ðŸ‡¬", rate: 15, on: false },
  ],
  monthly: [
    { id: "basic",    name: "Basic Package",    emoji: "ðŸŒ¿", maids: 1, daysPerWeek: 4, hoursPerDay: 4, priceMonthly: 960,  discountLabel: "" },
    { id: "standard", name: "Standard Package", emoji: "â­", maids: 1, daysPerWeek: 5, hoursPerDay: 4, priceMonthly: 1200, discountLabel: "MOST POPULAR" },
    { id: "premium",  name: "Premium Package",  emoji: "ðŸ‘‘", maids: 2, daysPerWeek: 5, hoursPerDay: 4, priceMonthly: 2400, discountLabel: "" },
  ],
  stayIn: [
    { id: "si1",  name: "1 Month",   months: 1,  price: 5500,  save: 0,     notes: "Includes accommodation & food allowance." },
    { id: "si3",  name: "3 Months",  months: 3,  price: 15000, save: 1500,  notes: "Best for short contracts. Save 1,500 QAR." },
    { id: "si6",  name: "6 Months",  months: 6,  price: 28500, save: 4500,  notes: "Visa processing included." },
    { id: "si12", name: "12 Months", months: 12, price: 54000, save: 12000, notes: "Full annual contract â€” visa, insurance, end-of-service benefits." },
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
    { id: "s1", name: "Maria Santos",    nationality: "philippines", status: "Available", color: "mint",   skills: ["regular","deep","movein"] },
    { id: "s2", name: "Anjali Sharma",   nationality: "indian",      status: "Busy",      color: "sky",    skills: ["regular","deep"] },
    { id: "s3", name: "Wendy Cruz",      nationality: "philippines", status: "Available", color: "pink",   skills: ["regular","deep","post"] },
    { id: "s4", name: "Amy Thapa",       nationality: "nepal",       status: "Available", color: "amber",  skills: ["regular","movein"] },
    { id: "s5", name: "Michael Okafor",  nationality: "nigeria",     status: "On-Leave",  color: "violet", skills: ["regular","post"] },
    { id: "s6", name: "John Reyes",      nationality: "philippines", status: "Available", color: "sky",    skills: ["regular","deep","movein","post"] },
    { id: "s7", name: "Priya Gurung",    nationality: "nepal",       status: "Busy",      color: "mint",   skills: ["regular","deep"] },
    { id: "s8", name: "Roselle Tan",     nationality: "philippines", status: "Available", color: "pink",   skills: ["regular","deep","post"] },
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
    "Microfibre cloths (Ã—6)",
    "Sponges & scrub pads",
    "Heavy-duty trash bags",
  ],
});

/* â”€â”€â”€ Sidebar â”€â”€â”€ */
const Sidebar = ({ active, onNav, onClose, mobile }) => (
  <aside className={`sidebar-bg flex flex-col text-ink-200 ${mobile ? "h-full w-72" : "w-64 sticky top-0 h-dvh"} `}>
    <div className="px-5 pt-5 pb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-mint-500 grid place-items-center shadow-mint">
          <AdminIcon name="sparkle" className="w-5 h-5 text-ink-900" strokeWidth={2.4}/>
        </div>
        <div>
          <div className="text-[14.5px] font-extrabold text-white tracking-tight">Maid Pro</div>
          <div className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-ink-400">Admin Â· v2.4</div>
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
        const isActive = active === n.id;
        return (
          <button key={n.id} onClick={() => { onNav(n.id); onClose && onClose(); }}
            className={`relative w-full flex items-center gap-3 h-10 px-3 rounded-lg text-[13.5px] font-medium transition-colors
              ${isActive ? "bg-white/10 text-white mint-rail" : "text-ink-300 hover:bg-white/5 hover:text-white"}`}>
            <AdminIcon name={n.icon} className="w-4 h-4"/>
            <span>{n.label}</span>
            {n.id === "bookings" && (
              <span className="ml-auto text-[10.5px] font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-mint-500/20 text-mint-300">12</span>
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
        <div className="mt-1 text-[11.5px] text-mint-100/80">Last sync 2 min ago.</div>
      </div>

      <div className="mt-3 px-2 py-2 flex items-center gap-3 rounded-lg hover:bg-white/5 cursor-pointer">
        <div className="w-9 h-9 rounded-full bg-mint-500/30 ring-1 ring-mint-400/40 grid place-items-center text-mint-200 font-bold text-[13px]">YN</div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-white truncate">Yusuf Nasser</div>
          <div className="text-[11px] text-ink-400 truncate">Operations Lead</div>
        </div>
        <button className="text-ink-400 hover:text-white" aria-label="Sign out">
          <AdminIcon name="logout" className="w-4 h-4"/>
        </button>
      </div>
    </div>
  </aside>
);

/* â”€â”€â”€ Top bar â”€â”€â”€ */
const TopBar = ({ section, onMenu, store, onClear }) => {
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
    staff: "Staff Management",
    settings: "Settings",
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
    staff: "Maids, skills, status and availability.",
    settings: "General configuration.",
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
          <TextField icon="search" value="" onChange={() => {}} placeholder="Search bookings, customersâ€¦"/>
        </div>

        <button
          onClick={() => { if (window.confirm('Clear all admin data and reset to defaults?')) onClear(); }}
          className="h-9 px-3.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-[13px] font-semibold transition-colors flex items-center gap-1.5"
        >
          <AdminIcon name="trash" className="w-4 h-4"/>
          Clear
        </button>

        <button className="relative w-10 h-10 rounded-lg grid place-items-center text-ink-700 hover:bg-ink-100">
          <AdminIcon name="bell" className="w-5 h-5"/>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-mint-500 ring-2 ring-white"></span>
        </button>

        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-ink-200">
          <div className="w-9 h-9 rounded-full bg-ink-900 text-white grid place-items-center text-[13px] font-bold">YN</div>
        </div>
      </div>
    </header>
  );
};

/* â”€â”€â”€â”€â”€â”€â”€ Capacity & Calendar â”€â”€â”€â”€â”€â”€â”€ */
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};

// Map booking date strings ("May 11") -> YYYY-MM-DD assuming the seed year is 2026
const monthShortToIdx = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
const bookingDateKey = (b) => {
  const parts = (b.date || "").split(" ");
  if (parts.length < 2) return null;
  const m = monthShortToIdx[parts[0]];
  if (m == null) return null;
  const day = parseInt(parts[1], 10);
  if (isNaN(day)) return null;
  return `2026-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
};

const CalendarSection = ({ store, set, bookings }) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const [view, setView] = React.useState(() => new Date(2026, 4, 1)); // May 2026 (matches seed bookings)
  const [selectedKey, setSelectedKey] = React.useState(ymd(new Date(2026, 4, 11)));

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

  const bookingsByDate = React.useMemo(() => {
    const m = {};
    for (const b of bookings) {
      const k = bookingDateKey(b);
      if (!k) continue;
      (m[k] = m[k] || []).push(b);
    }
    return m;
  }, [bookings]);

  const getEntry = (key) => store.availability[key] || { blocked: false, morning: true, afternoon: true };

  const toggleBlock = (key) => {
    const cur = getEntry(key);
    const next = !cur.blocked;
    set({
      availability: {
        ...store.availability,
        [key]: { blocked: next, morning: !next, afternoon: !next }
      }
    });
  };

  const toggleSlot = (key, slot) => {
    const cur = getEntry(key);
    const updated = { ...cur, [slot]: !cur[slot] };
    // if either slot still on, mark not blocked; if both off, blocked
    updated.blocked = !(updated.morning || updated.afternoon);
    set({ availability: { ...store.availability, [key]: updated } });
  };

  const blockedCount = Object.values(store.availability).filter(a => a.blocked).length;
  const partialCount = Object.values(store.availability).filter(a => !a.blocked && (!a.morning || !a.afternoon)).length;

  const selectedDate = selectedKey ? new Date(selectedKey + "T00:00:00") : null;
  const selectedEntry = selectedKey ? getEntry(selectedKey) : null;
  const selectedBookings = (selectedKey && bookingsByDate[selectedKey]) || [];

  const navMonth = (delta) => setView(new Date(view.getFullYear(), view.getMonth()+delta, 1));

  return (
    <div className="space-y-5 fade-up">
      {/* Daily staff schedule â€” primary view */}
      <StaffSchedule store={store} bookings={bookings} dateKey={selectedKey}/>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Days blocked",   value: blockedCount,             icon: "x",        tone: "red" },
          { label: "Partial days",   value: partialCount,             icon: "sliders",  tone: "ink" },
          { label: "Bookings (mo.)", value: bookings.length,          icon: "calendar", tone: "mint" },
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
              <IconBtn icon="chevron" onClick={() => navMonth(-1)} title="Previous month"/>
              <button onClick={() => { setView(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedKey(ymd(today)); }}
                className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-ink-700 hover:bg-ink-100">Today</button>
              <IconBtn icon="chevron" onClick={() => navMonth(1)} title="Next month"/>
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
                  aria-label={`${d.toDateString()} â€” ${entry.blocked ? "blocked" : partial ? "partial availability" : "available"}`}
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
                  {/* Slot strip â€” desktop */}
                  <div className="hidden sm:flex absolute bottom-1.5 left-1.5 right-1.5 gap-1">
                    <span className={`flex-1 h-1.5 rounded-full ${entry.blocked || !entry.morning ? "bg-ink-200" : "bg-mint-500"}`}></span>
                    <span className={`flex-1 h-1.5 rounded-full ${entry.blocked || !entry.afternoon ? "bg-ink-200" : "bg-mint-600"}`}></span>
                  </div>
                  {/* Booking dot â€” mobile */}
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
                {selectedDate ? selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "â€”"}
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
                <div className="text-[11.5px] opacity-80">{selectedEntry?.blocked ? "Re-open both slots." : "Mark as blackout â€” no new jobs."}</div>
              </div>
              <AdminIcon name={selectedEntry?.blocked ? "check" : "x"} className="w-5 h-5" strokeWidth={2.2}/>
            </button>

            {/* Slot toggles */}
            <div>
              <Label>Slots</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { key: "morning",   label: "Morning",   sub: "08:00 â€” 12:00" },
                  { key: "afternoon", label: "Afternoon", sub: "13:00 â€” 18:00" },
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
                        <div className="text-[11px] text-ink-500 truncate">{b.service} Â· {b.time} Â· {b.maids}Ã—{b.hours}h</div>
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

/* â”€â”€â”€â”€â”€â”€â”€ Staff Management â”€â”€â”€â”€â”€â”€â”€ */
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

const StaffSection = ({ store, set, bookings }) => {
  const update = (id, patch) => set({ staff: store.staff.map(s => s.id === id ? { ...s, ...patch } : s) });
  const remove = (id) => set({ staff: store.staff.filter(s => s.id !== id) });
  const toggleSkill = (sid, sk) => {
    const s = store.staff.find(x => x.id === sid); if (!s) return;
    const has = s.skills.includes(sk);
    update(sid, { skills: has ? s.skills.filter(x => x !== sk) : [...s.skills, sk] });
  };

  const blankDraft = () => ({ name: "", nationality: store.nationalities[0]?.id || "philippines", status: "Available", color: "mint", skills: [] });
  const [modalOpen, setModalOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(blankDraft);
  const toggleDraftSkill = (sk) => setDraft(d => ({ ...d, skills: d.skills.includes(sk) ? d.skills.filter(x => x !== sk) : [...d.skills, sk] }));
  const openModal = () => { setDraft(blankDraft()); setModalOpen(true); };
  const saveNew = () => {
    if (!draft.name.trim()) return;
    set({ staff: [...store.staff, { id: `s${Date.now()}`, ...draft }] });
    setModalOpen(false);
  };
  const activeMaids = store.staff.filter(s => s.status === "Available").length;
  const totalMaids = store.staff.length;
  const busy = store.staff.filter(s => s.status === "Busy").length;
  const leave = store.staff.filter(s => s.status === "On-Leave").length;

  return (
    <div className="space-y-5 fade-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Maids",   value: totalMaids,  icon: "users",  tone: "ink" },
          { label: "Available Now", value: activeMaids, icon: "check",  tone: "mint" },
          { label: "Busy",          value: busy,        icon: "sliders",tone: "ink" },
          { label: "On-Leave",      value: leave,       icon: "x",      tone: "ink" },
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
          <div className="text-[12px] text-ink-600">Customer bookings are capped at <span className="font-mono font-semibold">{Math.min(activeMaids, store.limits.maxMaids)}</span> maids per slot â€” the lower of available staff ({activeMaids}) and admin max ({store.limits.maxMaids}).</div>
        </div>
      </div>

      <Card title="Staff Directory" subtitle="Add, edit and manage every maid on the roster."
        action={<PrimaryBtn size="sm" onClick={openModal}><AdminIcon name="plus" className="w-4 h-4"/>Add staff</PrimaryBtn>} padded={false}>
        <div className="hidden md:grid grid-cols-[56px_1.4fr_1.1fr_1.1fr_1.6fr_120px_60px] gap-3 px-6 py-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-200/70 bg-ink-50/50">
          <div></div><div>Name</div><div>Nationality</div><div>Status</div><div>Skills</div><div>Active jobs</div><div></div>
        </div>
        <ul>
          {store.staff.map((s, i) => {
            const jobs = Object.values(store.assignments || {}).filter(arr => arr.includes(s.id)).length;
            return (
              <li key={s.id} className={`px-4 sm:px-6 py-3 ${i ? "border-t border-ink-200/70" : ""}`}>
                <div className="grid grid-cols-[48px_1fr] md:grid-cols-[56px_1.4fr_1.1fr_1.1fr_1.6fr_120px_60px] gap-3 items-center">
                  <StaffAvatar s={s} size={40}/>
                  <div className="md:contents space-y-2 md:space-y-0">
                    <TextField value={s.name} onChange={v => update(s.id, { name: v })} />
                    <select value={s.nationality} onChange={e => update(s.id, { nationality: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
                      {store.nationalities.map(n => <option key={n.id} value={n.id}>{n.flag} {n.name}</option>)}
                    </select>
                    <select value={s.status} onChange={e => update(s.id, { status: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-white hairline text-[13.5px] text-ink-900 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]">
                      {STAFF_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                    <div className="flex flex-wrap gap-1.5">
                      {store.services.map(sv => {
                        const on = s.skills.includes(sv.id);
                        return (
                          <button key={sv.id} onClick={() => toggleSkill(s.id, sv.id)}
                            className={`inline-flex items-center gap-1 h-7 px-2 rounded-full text-[11.5px] font-semibold transition-colors
                              ${on ? "bg-mint-500 text-ink-900" : "hairline text-ink-600 hover:bg-ink-50"}`}>
                            <span>{sv.emoji}</span>{sv.name.split(" ")[0]}
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
                    {store.nationalities.map(n => <option key={n.id} value={n.id}>{n.flag} {n.name}</option>)}
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
                <Label>Skills</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {store.services.map(sv => {
                    const on = draft.skills.includes(sv.id);
                    return (
                      <button key={sv.id} onClick={() => toggleDraftSkill(sv.id)}
                        className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[12px] font-semibold transition-colors
                          ${on ? "bg-mint-500 text-ink-900" : "hairline text-ink-600 hover:bg-ink-50"}`}>
                        <span>{sv.emoji}</span>{sv.name.split(" ")[0]}
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

/* â”€ 12-hour AM/PM time formatter â”€ */
const fmt12 = (h, m = 0) => {
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr}:00 ${ap}` : `${hr}:${String(m).padStart(2,"0")} ${ap}`;
};

/* â”€â”€â”€ Daily staff schedule (used inside CalendarSection) â”€â”€â”€ */
const SCHEDULE_HOURS = [8,9,10,11,12,13,14,15,16,17,18];
const parseHour = (t) => { if (!t || t === "â€”") return null; const [h,m] = t.split(":").map(Number); return isNaN(h) ? null : h + (m||0)/60; };

const StaffSchedule = ({ store, bookings, dateKey }) => {
  const todays = bookings.filter(b => bookingDateKey(b) === dateKey && b.status !== "Cancelled");
  const cellH = 56;
  const order = { Available: 0, Busy: 1, "On-Leave": 2 };
  const staff = [...store.staff].sort((a,b) => order[a.status] - order[b.status]);

  return (
    <Card padded={false} title="Daily Staff Schedule"
      subtitle={dateKey ? `Jobs and availability for ${new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}.` : "Pick a date above."}>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid sticky top-0 z-10 bg-white border-b border-ink-200/70"
               style={{ gridTemplateColumns: `64px repeat(${staff.length}, minmax(132px, 1fr))` }}>
            <div></div>
            {staff.map(s => (
              <div key={s.id} className="flex flex-col items-center gap-1.5 py-3 px-2">
                <StaffAvatar s={s} size={44}/>
                <div className="text-[12.5px] font-bold text-ink-900 truncate max-w-full">{s.name.split(" ")[0]}</div>
                <div className="flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-[0.12em] text-ink-500">
                  <StatusDot status={s.status}/>{s.status}
                </div>
              </div>
            ))}
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
                  const isOff = s.status === "On-Leave";
                  return (
                    <div key={`${s.id}-${h}`}
                         className={`border-b border-r border-ink-200/70 ${isOff ? "bg-ink-50/60" : "bg-white"}`}
                         style={{ gridColumn: sIdx + 2, gridRow: hIdx + 1 }}/>
                  );
                })}
                {todays.filter(b => (store.assignments?.[b.ref] || []).includes(s.id)).map(b => {
                  const start = parseHour(b.time); if (start == null) return null;
                  const startIdx = Math.max(0, start - SCHEDULE_HOURS[0]);
                  const span = Math.min(SCHEDULE_HOURS.length - startIdx, b.hours);
                  if (span <= 0) return null;
                  const c = STAFF_COLORS[s.color] || STAFF_COLORS.mint;
                  return (
                    <div key={`${b.ref}-${s.id}`}
                      className={`relative m-1 rounded-lg ring-1 px-2.5 py-1.5 text-left overflow-hidden ${c.block}`}
                      style={{ gridColumn: sIdx + 2, gridRow: `${startIdx+1} / span ${span}` }}>
                      <div className="text-[10.5px] font-mono opacity-80">{(() => { const h = Math.floor(start), m = Math.round((start-h)*60); const e = start + b.hours; const eh = Math.floor(e), em = Math.round((e-eh)*60); return `${fmt12(h,m)} â€“ ${fmt12(eh,em)}`; })()}</div>
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

/* â”€â”€â”€ Settings (lightweight) â”€â”€â”€ */
const SettingsSection = ({ store, set }) => (
  <div className="space-y-5 fade-up">
    <Card title="Brand Identity" subtitle="Customer-facing details surfaced across the app.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>Brand name</Label><TextField value="Maid Pro" onChange={()=>{}} className="mt-2"/></div>
        <div><Label>Support phone</Label><TextField value="+974 4400 1188" onChange={()=>{}} className="mt-2"/></div>
        <div><Label>Currency</Label><TextField value="QAR" onChange={()=>{}} className="mt-2"/></div>
        <div><Label>Time zone</Label><TextField value="Asia/Qatar (GMT+3)" onChange={()=>{}} className="mt-2"/></div>
      </div>
    </Card>
    <Card title="Booking Rules">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          ["Auto-confirm bookings", true],
          ["Send SMS reminders",    true],
          ["Allow guest checkout",  false],
          ["Require ID verification", true],
          ["Charge no-show fee",    false],
          ["Show maid photos",      true],
        ].map(([label, on]) => (
          <div key={label} className="flex items-center justify-between rounded-lg hairline bg-white px-3 py-2.5">
            <span className="text-[13px] text-ink-800 font-medium">{label}</span>
            <Switch on={on} onChange={() => {}} ariaLabel={label}/>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

/* â”€â”€â”€ Root App â”€â”€â”€ */
const App = () => {
  const [section, setSection] = React.useState("overview");
  const [store, setStore] = React.useState(initialStore());
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const set = (patch) => setStore(prev => ({ ...prev, ...patch }));
  const clearStore = () => setStore(initialStore());

  /* Live bookings from Supabase */
  const [bookings, setBookings] = React.useState([]);
  const [bLoading, setBLoading] = React.useState(true);

  const fetchBookings = React.useCallback(async () => {
    const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(500);
    if (!error && data) setBookings(data.map(fmtBooking));
    setBLoading(false);
  }, []);

  React.useEffect(() => {
    fetchBookings();
    const ch = supabase.channel('admin-bookings-live').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings).subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchBookings]);

  const todayISO  = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const todayBks  = bookings.filter(b => b._raw && b._raw.date === todayISO);
  const mtdRev    = bookings.filter(b => ['Confirmed','Completed'].includes(b.status) && (b._raw && b._raw.created_at || '').startsWith(thisMonth)).reduce((s, b) => s + b.total, 0);
  const activeMaids = todayBks.filter(b => b.status === 'Confirmed').reduce((s, b) => s + b.maids, 0);
  const doneCount = bookings.filter(b => b.status === 'Completed').length;
  const doneOf    = bookings.filter(b => ['Confirmed','Completed','Cancelled'].includes(b.status)).length;
  const compRate  = doneOf > 0 ? ((doneCount / doneOf) * 100).toFixed(1) : "0";
  const dynamicKpis = [
    { label: "Bookings Today",  value: String(todayBks.length),  unit: "jobs", delta: 0, icon: "calendar", tone: "mint" },
    { label: "Active Maids",    value: String(activeMaids || 0), unit: "live", delta: 0, icon: "users",    tone: "ink"  },
    { label: "Revenue (MTD)",   value: mtdRev.toLocaleString(),  unit: "QAR",  delta: 0, icon: "money",    tone: "mint" },
    { label: "Completion Rate", value: compRate,                 unit: "%",    delta: 0, icon: "trend",    tone: "ink"  },
  ];
  const sections = {
    overview:      <OverviewSection store={store} kpis={dynamicKpis} bookings={bookings}/>,
    bookings:      <BookingsSection bookings={bookings} store={store} set={set} loading={bLoading}/>,
    hourly:        <HourlySection store={store} set={set}/>,
    monthly:       <MonthlySection store={store} set={set}/>,
    stayin:        <StayInSection store={store} set={set}/>,
    nationalities: <NationalitiesSection store={store} set={set}/>,
    materials:     <MaterialsSection store={store} set={set}/>,
    calendar:      <CalendarSection store={store} set={set} bookings={bookings}/>,
    staff:         <StaffSection store={store} set={set} bookings={bookings}/>,
    settings:      <SettingsSection store={store} set={set}/>
  };

  return (
    <div className="min-h-dvh flex" data-screen-label="01 Admin Dashboard">
      {/* desktop sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar active={section} onNav={setSection}/>
      </div>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setDrawerOpen(false)}></div>
          <div className="relative animate-[fadeUp_.2s_ease]">
            <Sidebar active={section} onNav={setSection} onClose={() => setDrawerOpen(false)} mobile/>
          </div>
        </div>
      )}

      {/* main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar section={section} onMenu={() => setDrawerOpen(true)} store={store} onClear={clearStore}/>
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1480px] w-full mx-auto">
          {sections[section]}
        </main>
        <footer className="px-4 sm:px-6 lg:px-8 py-5 text-[11.5px] font-mono uppercase tracking-[0.14em] text-ink-500 flex items-center justify-between border-t border-ink-200/70">
          <span>Â© Maid Pro Admin Â· 2026</span>
          <span>v2.4.0 Â· Build 18a3f</span>
        </footer>
      </div>
    </div>
  );
};

export default App;


import React from 'react'
import { Icon, Counter, BigCounter, Pill, PrimaryButton, GhostButton, SectionLabel, Field, TextInput } from './ui'
import { SERVICE_TYPES, MONTHLY_PACKAGES, STAYIN_PACKAGES, NATIONALITIES, MATERIALS_PER_HOUR, natRate, Money } from './pricing'
import { SvcIcon, SVC_ICONS } from './serviceIcons'

const toISO = (s) => {
  if (!s) return '';
  const t = s.trim();
  if (/^[A-Z]{2}$/i.test(t)) return t.toLowerCase();
  const pts = [...t].map(c => c.codePointAt(0));
  if (pts.length >= 2 && pts[0] >= 0x1F1E6 && pts[0] <= 0x1F1FF)
    return pts.slice(0,2).map(p => String.fromCharCode(p - 0x1F1E6 + 65)).join('').toLowerCase();
  return '';
};

const Flag = ({ code, size = 22 }) => {
  const iso = toISO(code);
  if (!iso) return <span className="text-[15px]">🌍</span>;
  return (
    <img src={`https://flagcdn.com/w40/${iso}.png`} alt={iso.toUpperCase()}
      width={size} height={Math.round(size * 0.67)}
      className="object-cover rounded-sm inline-block flex-shrink-0"
      onError={e => { e.currentTarget.style.display = 'none'; }}
    />
  );
};

/* All 6 steps */

/* ────────────── STEP 1: Service ────────────── */
const DAY_LETTERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CustomMonthlyConfig = ({ state, set, discountPct = 10 }) => {
  const days = state.customDays || 4;
  const maids = state.customMaids || 1;
  const hours = state.customHours || 4;
  const rate = (typeof natRate === "function") ? natRate(state) : 15;
  const subtotal = rate * hours * maids * days * 4;
  const discount = Math.round(subtotal * (discountPct / 100));
  const total = subtotal - discount;

  // Cap specific-day list to selected number of days
  React.useEffect(() => {
    if (state.specificDays && (state.specificDayList || []).length > days) {
      set({ specificDayList: state.specificDayList.slice(0, days) });
    }
  }, [days, state.specificDays]);

  const toggleDay = (d) => {
    const cur = state.specificDayList || [];
    if (cur.includes(d)) {
      set({ specificDayList: cur.filter(x => x !== d) });
    } else if (cur.length < days) {
      set({ specificDayList: [...cur, d] });
    }
  };
  const picked = (state.specificDayList || []).length;
  const atLimit = picked >= days;

  return (
    <div className="mt-2.5 p-4 rounded-2xl bg-white hairline space-y-4 fade-up">
      <div className="grid grid-cols-3 gap-2">
        <BigCounter label="Days/wk" value={days} onChange={v => set({ customDays: v })}
          min={1} max={7} suffix={days === 1 ? "day" : "days"} />
        <BigCounter label="Maids" value={maids} onChange={v => set({ customMaids: v })}
          min={1} max={4} suffix={maids === 1 ? "maid" : "maids"} />
        <BigCounter label="Hrs/day" value={hours} onChange={v => set({ customHours: v })}
          min={2} max={10} suffix="hrs" />
      </div>

      {/* Specific days checkbox */}
      <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
        ${state.specificDays ? "bg-mint-50 ring-2 ring-mint-500" : "bg-ink-50 hover:bg-ink-100"}`}>
        <span className={`w-5 h-5 rounded-md grid place-items-center flex-shrink-0 transition-colors
          ${state.specificDays ? "bg-mint-500 text-white" : "bg-white hairline text-transparent"}`}>
          <Icon name="check" className="w-3.5 h-3.5" strokeWidth={3} />
        </span>
        <input type="checkbox" className="sr-only" checked={state.specificDays}
          onChange={e => set({ specificDays: e.target.checked, specificDayList: e.target.checked ? state.specificDayList : [] })} />
        <div className="flex-1">
          <div className="font-bold text-ink-900 text-[13.5px]">I need specific days of the week</div>
          <div className="text-[11.5px] text-ink-500">e.g. only Sun, Tue &amp; Thu — otherwise we&rsquo;ll schedule the best fit</div>
        </div>
      </label>

      {state.specificDays && (
        <div className="fade-up">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">
              Pick {days} day{days > 1 ? "s" : ""} of the week
            </div>
            <div className={`text-[11px] font-mono tabular-nums ${atLimit ? "text-mint-700 font-bold" : "text-ink-500"}`}>
              {picked} / {days}
            </div>
          </div>
          <div className="flex gap-1.5">
            {DAY_LETTERS.map(d => {
              const on = (state.specificDayList || []).includes(d);
              const disabled = !on && atLimit;
              return (
                <button key={d} disabled={disabled} onClick={() => toggleDay(d)}
                  className={`flex-1 h-10 rounded-lg text-[12px] font-bold transition-all
                    ${on ? "bg-mint-500 text-white shadow-mint"
                       : disabled ? "bg-ink-50 text-ink-300 cursor-not-allowed"
                       : "bg-white hairline text-ink-700 hover:bg-ink-50"}`}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Live custom price */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-mint-50 ring-1 ring-mint-200">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-500">Custom monthly</div>
          <div className="text-[11.5px] text-ink-500 mt-0.5">
            <span className="line-through font-mono">{subtotal.toLocaleString()} QAR</span>
            <span className="ml-2 text-mint-700 font-semibold">−{discountPct}% off</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono tabular-nums font-bold text-mint-700 text-[18px]">{total.toLocaleString()} QAR</div>
          <div className="text-[11px] text-ink-400 -mt-0.5">/month</div>
        </div>
      </div>
    </div>
  );
};

const SERVICE_COLORS = {
  regular: {
    idle:   'bg-sky-50 ring-1 ring-sky-200 hover:bg-sky-100',
    active: 'bg-sky-100 ring-2 ring-sky-400',
    icon:   'text-sky-500',
    name:   'text-sky-900',
    rate:   'text-sky-600',
    check:  'text-sky-600',
  },
  deep: {
    idle:   'bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100',
    active: 'bg-amber-100 ring-2 ring-amber-400',
    icon:   'text-amber-500',
    name:   'text-amber-900',
    rate:   'text-amber-600',
    check:  'text-amber-600',
  },
  movein: {
    idle:   'bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100',
    active: 'bg-emerald-100 ring-2 ring-emerald-400',
    icon:   'text-emerald-500',
    name:   'text-emerald-900',
    rate:   'text-emerald-600',
    check:  'text-emerald-600',
  },
  post: {
    idle:   'bg-orange-50 ring-1 ring-orange-200 hover:bg-orange-100',
    active: 'bg-orange-100 ring-2 ring-orange-400',
    icon:   'text-orange-500',
    name:   'text-orange-900',
    rate:   'text-orange-600',
    check:  'text-orange-600',
  },
};
const SVC_COLOR_DEFAULT = {
  idle:   'bg-violet-50 ring-1 ring-violet-200 hover:bg-violet-100',
  active: 'bg-violet-100 ring-2 ring-violet-400',
  icon:   'text-violet-500',
  name:   'text-violet-900',
  rate:   'text-violet-600',
  check:  'text-violet-600',
};

const StepService = ({ state, set, nationalities, enabledModes, liveModesData, natsBlockEnabled, liveServices, liveMonthly, liveStayIn, liveLimits, materialsRate }) => {
  const NATS     = nationalities || NATIONALITIES;
  const minHours = Number(liveLimits?.minHours) || 2;
  const maxHours = Number(liveLimits?.maxHours) || 12;
  const maxMaids = Number(liveLimits?.maxMaids) || 4;
  const SERVICES = (liveServices && liveServices.length) ? liveServices : SERVICE_TYPES;
  const MONTHLY  = (liveMonthly  && liveMonthly.length)  ? liveMonthly  : MONTHLY_PACKAGES;
  const STAYIN   = (liveStayIn   && liveStayIn.length)   ? liveStayIn   : STAYIN_PACKAGES;
  const modeEnabled = (id) => !enabledModes || enabledModes.includes(id);

  // Returns the nationality-adjusted rate/price for any service, package or plan
  const natId = state.nationality || '';
  const getRate = (obj, defaultVal) => {
    if (!natsBlockEnabled) return defaultVal;                          // nationality OFF → default
    const rates = obj?.nationalityRates || obj?.nationalityPrices || {};
    if (rates[natId] != null) return Number(rates[natId]);            // per-service nat rate
    const natObj = NATS.find(n => n.id === natId);
    // For hourly fall back to nationality base rate; for packages stay at default
    return defaultVal;
  };
  const getHourlyRate = (svc) => {
    if (!natsBlockEnabled) return svc.rate;
    const rates = svc?.nationalityRates || {};
    if (rates[natId] != null) return Number(rates[natId]);
    return svc.rate;
  };
  return (
    <div className="fade-up space-y-4">
      {/* Mode tabs */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${[modeEnabled('hourly'),modeEnabled('monthly'),modeEnabled('stayin')].filter(Boolean).length}, 1fr)` }}>
        {[
          { id: "hourly",  label: "Hourly",  fallbackIcon: "Clock"    },
          { id: "monthly", label: "Monthly", fallbackIcon: "Calendar" },
          { id: "stayin",  label: "Stay-In", fallbackIcon: "Home"     },
        ].filter(t => modeEnabled(t.id)).map(t => {
          const dbMode = (liveModesData || []).find(m => m.id === t.id);
          const icon = (dbMode?.icon && SVC_ICONS[dbMode.icon]) ? dbMode.icon : t.fallbackIcon;
          const active = state.mode === t.id;
          return (
            <button key={t.id} onClick={() => set({ mode: t.id })}
              className={`h-10 sm:h-11 rounded-xl text-[13px] sm:text-[14px] font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-all
                ${active ? "bg-ink-900 text-white shadow-card" : "bg-ink-50 text-ink-600 hover:bg-ink-100"}`}>
              <SvcIcon name={icon} className="w-4 h-4" strokeWidth={1.75} />{t.label}
            </button>
          );
        })}
      </div>

      {/* Nationality */}
      {natsBlockEnabled !== false && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2">Maid nationality</div>
          <div className="grid grid-cols-2 gap-2">
            {NATS.map(n => {
              const active = state.nationality === n.id;
              return (
                <button key={n.id} onClick={() => set({ nationality: n.id, nationalityRate: n.rate })}
                  className={`h-10 sm:h-11 px-2.5 sm:px-3 rounded-xl text-[12.5px] sm:text-[13px] font-semibold flex items-center gap-2 transition-all
                    ${active ? "bg-mint-50 ring-2 ring-mint-500 text-ink-900" : "bg-white hairline text-ink-700 hover:bg-ink-50"}`}>
                  <Flag code={n.flag} size={24}/>
                  <span className="flex-1 text-left truncate">{n.name}</span>
                  {active && <span className="w-2 h-2 rounded-full bg-mint-500 flex-shrink-0"/>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Service selector — same compact row style as nationality */}
      {state.mode === "hourly" && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2">Services</div>
        <div className="grid grid-cols-1 gap-2">
          {SERVICES.map(t => {
            const active = state.serviceType === t.id;
            const theme = SERVICE_COLORS[t.id] || SVC_COLOR_DEFAULT;
            return (
              <button key={t.id} onClick={() => set({ serviceType: t.id })}
                className={`h-11 sm:h-12 px-2.5 sm:px-3 rounded-xl text-[12.5px] sm:text-[13px] font-semibold flex items-center gap-2.5 sm:gap-3 transition-all
                  ${active ? theme.active : theme.idle}`}>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                  ${active ? "bg-white/30" : "bg-white hairline"}`}>
                  {t.icon
                    ? <SvcIcon name={t.icon} className={`w-4 h-4 ${theme.icon}`} strokeWidth={1.6}/>
                    : <span className="text-[15px]">{t.emoji}</span>}
                </div>
                <span className={`flex-1 text-left truncate ${theme.name}`}>{t.name}</span>
                <span className={`font-mono text-[11.5px] sm:text-[12px] flex-shrink-0 ${theme.rate}`}>{getHourlyRate(t)} QAR/hr</span>
                {active && <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${theme.check} bg-white/30`}><Icon name="check" className="w-3 h-3" strokeWidth={3}/></span>}
              </button>
            );
          })}
        </div>
        </div>
      )}

      {/* Counters — hourly */}
      {state.mode === "hourly" && (
        <div className="grid grid-cols-2 gap-2">
          <BigCounter label={`Hours (min ${minHours})`} value={state.hours} onChange={v => set({ hours: v })} min={minHours} max={maxHours} suffix="hrs"/>
          <BigCounter label="Number of maids" value={state.maids} onChange={v => set({ maids: v })} min={1} max={maxMaids} suffix={state.maids === 1 ? "maid" : "maids"}/>
        </div>
      )}

      {/* Materials add-on — hourly only */}
      {state.mode === "hourly" && (
        <label className={`flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl cursor-pointer transition-all
          ${state.materials ? "bg-mint-50 ring-2 ring-mint-500" : "bg-ink-50 hairline hover:bg-ink-100"}`}>
          <input type="checkbox" className="sr-only" checked={state.materials} onChange={e => set({ materials: e.target.checked })} />
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl grid place-items-center flex-shrink-0 transition-colors
            ${state.materials ? "bg-mint-500" : "bg-white hairline"}`}>
            <SvcIcon name="SprayCan" className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${state.materials ? "text-white" : "text-ink-400"}`} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-ink-900 text-[13px] sm:text-[14px]">Cleaning materials</div>
            <div className="text-[11.5px] sm:text-[12.5px] text-ink-500 mt-0.5">Mop, bucket &amp; all supplies · +{materialsRate || 10} QAR/hr</div>
          </div>
          <span className={`w-6 h-6 rounded-full grid place-items-center flex-shrink-0 transition-colors
            ${state.materials ? "bg-mint-500 text-white" : "bg-white hairline text-transparent"}`}>
            <Icon name="check" className="w-3.5 h-3.5" strokeWidth={3} />
          </span>
        </label>
      )}

      {/* Monthly packages */}
      {state.mode === "monthly" && (
        <div className="space-y-2">
          {MONTHLY.map(p => {
            const active = state.packageId === p.id;
            const isCustom = p.custom;
            return (
              <div key={p.id}>
                <button onClick={() => set({ packageId: p.id })}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3
                    ${active ? "bg-mint-50 ring-2 ring-mint-500" : "bg-white hairline hover:bg-ink-50"}`}>
                  <div className={`w-10 h-10 rounded-xl grid place-items-center flex-shrink-0 ${active ? "bg-mint-500" : "bg-ink-50"}`}>
                    {(p.icon && SVC_ICONS[p.icon])
                      ? <SvcIcon name={p.icon} className={`w-5 h-5 ${active ? "text-white" : "text-ink-600"}`} strokeWidth={1.75} />
                      : <span className="text-[20px]">{p.emoji}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink-900 text-[14px]">{p.name}</span>
                      {(p.popular || p.discountLabel) && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{p.discountLabel || "Popular"}</span>}
                    </div>
                    <div className="text-[12px] text-ink-500">{isCustom ? "Customize your own schedule" : `${p.maids} maid · ${p.daysPerWeek}d/wk · ${p.hoursPerDay}h/day`}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {isCustom ? <span className="text-mint-700 font-bold text-[14px]">Custom</span>
                      : <><div className="font-mono font-bold text-mint-700 text-[15px]">{getRate(p, p.priceMonthly||0).toLocaleString()} QAR</div><div className="text-[11px] text-ink-400">/month</div></>}
                  </div>
                </button>
                {isCustom && active && <CustomMonthlyConfig state={state} set={set} discountPct={p.customDiscount ?? 10}/>}
              </div>
            );
          })}
        </div>
      )}

      {/* Stay-in packages */}
      {state.mode === "stayin" && (
        <div className="space-y-2">
          <div className="px-3 py-2 rounded-xl bg-mint-50 ring-1 ring-mint-200 text-[12.5px] text-ink-700">
            <span className="font-bold text-mint-800">Stay-in maid</span> · Full-time live-in. Includes accommodation, meals & rest per Qatar labour law.
          </div>
          {STAYIN.map(p => {
            const active = state.stayInId === p.id;
            return (
              <button key={p.id} onClick={() => set({ stayInId: p.id })}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3
                  ${active ? "bg-mint-50 ring-2 ring-mint-500" : "bg-white hairline hover:bg-ink-50"}`}>
                <div className={`w-10 h-10 rounded-xl grid place-items-center flex-shrink-0 ${active ? "bg-mint-500" : "bg-ink-50"}`}>
                  {(p.icon && SVC_ICONS[p.icon])
                    ? <SvcIcon name={p.icon} className={`w-5 h-5 ${active ? "text-white" : "text-ink-600"}`} strokeWidth={1.75} />
                    : <span className="text-[20px]">{p.emoji}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink-900 text-[14px]">{p.name}</span>
                    {p.popular && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Popular</span>}
                    {p.save > 0 && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-mint-100 text-mint-800">Save {p.save.toLocaleString()} QAR</span>}
                  </div>
                  <div className="text-[12px] text-ink-500">~{Math.round(getRate(p, p.price)/p.months).toLocaleString()} QAR/month equivalent</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-bold text-mint-700 text-[15px]">{getRate(p, p.price).toLocaleString()} QAR</div>
                  <div className="text-[11px] text-ink-400">total</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ────────────── STEP 2: Date ────────────── */
const Calendar = ({ value, onChange, leadHours = 1, liveAvailability = {} }) => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0,0,0,0);
  const [view, setView] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const monthLabel = view.toLocaleString(undefined, { month: "long", year: "numeric" });
  const firstDay = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
  const shift = (n) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));

  const ymdLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const isBlocked = (d) => {
    if (!d) return false;
    const entry = liveAvailability[ymdLocal(d)];
    return entry?.blocked === true;
  };

  return (
    <div className="bg-white rounded-2xl hairline p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-ink-900 text-[16px]">{monthLabel}</div>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} className="w-9 h-9 rounded-xl hover:bg-ink-100 grid place-items-center text-ink-700"><Icon name="arrow-left" className="w-4 h-4" /></button>
          <button onClick={() => shift(1)} className="w-9 h-9 rounded-xl hover:bg-ink-100 grid place-items-center text-ink-700"><Icon name="arrow-right" className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i) => (
          <div key={i} className="text-center text-[11px] font-bold text-ink-400 uppercase">{d.slice(0,1)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const past = d < today;
          const blocked = isBlocked(d);
          const isToday = sameDay(d, today);
          const sel = sameDay(d, value);
          const disabled = past || blocked;
          return (
            <button key={i} disabled={disabled} onClick={() => onChange(d)} title={blocked ? "Closed" : ""}
              className={`aspect-square rounded-xl text-[14px] font-semibold relative transition-all
                ${sel     ? "bg-mint-500 text-white shadow-mint"
                : past    ? "text-ink-200 cursor-not-allowed"
                : blocked ? "bg-red-50 text-red-300 cursor-not-allowed line-through"
                          : "text-ink-800 hover:bg-mint-50"}`}>
              {d.getDate()}
              {isToday && !sel && !blocked && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-mint-500"></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const StepDate = ({ state, set, liveLimits, liveAvailability = {} }) => {
  return (
    <div className="fade-up">
      <SectionLabel title="When should we arrive?" />
      <Calendar value={state.date} onChange={(d) => set({ date: d })}
        leadHours={Number(liveLimits?.leadHours) || 1}
        liveAvailability={liveAvailability} />
    </div>
  );
};

/* ────────────── STEP 3: Time ────────────── */
const hourToLabel = (h) => {
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${ap}`;
};

const buildTimeGroups = (open = 8, close = 19) => {
  const all = Array.from({ length: close - open + 1 }, (_, i) => ({ h: open + i, t: hourToLabel(open + i) }));
  const morning   = all.filter(s => s.h < 12);
  const midday    = all.filter(s => s.h >= 12 && s.h < 17);
  const afternoon = all.filter(s => s.h >= 17);
  return [
    morning.length   ? { label: 'Morning',   slots: morning   } : null,
    midday.length    ? { label: 'Midday',     slots: midday    } : null,
    afternoon.length ? { label: 'Afternoon',  slots: afternoon } : null,
  ].filter(Boolean);
};
const parseSlotHour = (timeStr) => {
  if (!timeStr || timeStr === '—') return NaN;
  const [timePart, ampm] = timeStr.trim().split(' ');
  let h = parseInt(timePart.split(':')[0], 10);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h;
};

const StepTime = ({ state, set, slotData = { bookings: [], availableCount: 0, loading: false }, businessHours = { open: 8, close: 19 } }) => {
  const TIME_GROUPS = buildTimeGroups(businessHours.open, businessHours.close);
  const now = new Date();
  const today = new Date(); today.setHours(0,0,0,0);
  const sel = state.date ? new Date(state.date) : today;
  sel.setHours(0,0,0,0);
  const isToday = sel.getTime() === today.getTime();
  // Block any slot whose start hour has already begun (2:31 PM → block up to and including 2 PM)
  const cutoffHour = now.getHours();

  // Returns true when all available maids are occupied for hour h
  const isFull = (h) => {
    const { bookings, availableCount } = slotData;
    if (!availableCount) return false;
    const busyMaids = new Set();
    let unassignedCleaners = 0;
    bookings.forEach(b => {
      const startH = parseSlotHour(b.time);
      if (isNaN(startH)) return;
      const endH = startH + (b.hours || 1);
      if (startH <= h && h < endH) {
        if (Array.isArray(b.assigned_staff) && b.assigned_staff.length > 0) {
          b.assigned_staff.forEach(id => busyMaids.add(id));
        } else {
          unassignedCleaners += (b.cleaners || 1);
        }
      }
    });
    return (busyMaids.size + unassignedCleaners) >= availableCount;
  };

  return (
    <div className="fade-up">
      <SectionLabel title="Pick a time slot" subtitle={slotData.loading ? "Checking availability…" : "Select your preferred start time."} />
      <div className="space-y-4">
        {TIME_GROUPS.map(g => (
          <div key={g.label}>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2">{g.label}</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {g.slots.map(({ t, h }) => {
                const active = state.time === t;
                const past = isToday && h <= cutoffHour;
                const full = !past && isFull(h);
                const unavailable = past || full;
                return (
                  <button key={t} disabled={unavailable} onClick={() => !unavailable && set({ time: t })}
                    className={`h-[52px] sm:h-[60px] rounded-xl flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all
                      ${active     ? "bg-mint-500 text-white shadow-mint"
                      : past       ? "bg-ink-100 text-ink-300 cursor-not-allowed"
                      : full       ? "bg-red-50 text-red-300 cursor-not-allowed hairline"
                      :              "bg-white hairline text-ink-900 hover:bg-mint-50"}`}>
                    <span className="font-mono text-[13px] sm:text-[14px] font-bold tabular-nums">{t}</span>
                    <span className={`text-[10px] sm:text-[10.5px] font-semibold
                      ${active ? "text-white/80" : past ? "text-ink-400" : full ? "text-red-400" : "text-mint-600"}`}>
                      {past ? "Past" : full ? "Full" : "Available"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ────────────── STEP 4: Location ────────────── */
const StepLocation = ({ state, set }) => {
  const [coords, setCoords] = React.useState({ x: 56, y: 44 });
  const [locStatus, setLocStatus] = React.useState("idle"); // idle | locating | ok | error
  const [geo, setGeo] = React.useState(null);

  const detectLocation = React.useCallback(() => {
    setLocStatus("locating");
    if (!navigator.geolocation) {
      // graceful demo fallback
      setTimeout(() => {
        setGeo({ lat: 25.2867, lng: 51.5333, accuracy: 24 });
        setCoords({ x: 50, y: 48 });
        setLocStatus("ok");
      }, 900);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
        setCoords({ x: 50, y: 48 });
        setLocStatus("ok");
      },
      () => {
        // demo fallback
        setGeo({ lat: 25.2867, lng: 51.5333, accuracy: 24 });
        setCoords({ x: 50, y: 48 });
        setLocStatus("ok");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  React.useEffect(() => { detectLocation(); }, [detectLocation]);

  return (
    <div className="fade-up space-y-4">
      <SectionLabel title="Where are we headed?" subtitle="Tell us who you are and where to come." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Full name" hint="Required">
          <TextInput icon="user" placeholder="Aisha Rahman" value={state.name || ""} onChange={e => set({ name: e.target.value })}/>
        </Field>
        <Field label="Contact number" hint="Required">
          <TextInput icon="phone" placeholder="+974 5512 4488" value={state.phone || ""} onChange={e => set({ phone: e.target.value })}/>
        </Field>
        <Field label="Full address" hint="Required" className="sm:col-span-2">
          <TextInput icon="pin" placeholder="Building, street, zone, city" value={state.address || ""} onChange={e => set({ address: e.target.value })}/>
        </Field>
        <Field label="Notes for the team" optional className="sm:col-span-2">
          <textarea rows={3} placeholder="Lift code, parking, pets, allergies, special instructions…"
            value={state.notes || ""} onChange={e => set({ notes: e.target.value })}
            className="w-full p-3 rounded-xl bg-white hairline text-[14px] text-ink-900 placeholder:text-ink-400 focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)] outline-none transition-shadow resize-none"/>
        </Field>
      </div>
    </div>
  );
};

/* ────────────── STEP 5: Confirm ────────────── */
const SummaryRow = ({ icon, label, value, onEdit }) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-0">
    <div className="w-8 h-8 rounded-lg bg-mint-50 text-mint-700 grid place-items-center flex-shrink-0">
      <Icon name={icon} className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[10.5px] font-mono uppercase text-ink-400">{label}</div>
      <div className="text-[13.5px] text-ink-900 font-medium truncate">{value || "—"}</div>
    </div>
    {onEdit && (
      <button onClick={onEdit} className="text-[12px] font-semibold text-mint-700 hover:text-mint-800 px-2 py-1 rounded-lg hover:bg-mint-50 flex-shrink-0">Edit</button>
    )}
  </div>
);

const StepConfirm = ({ state, set, breakdown, goTo }) => {
  const fmtDate = state.date ? state.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : null;
  return (
    <div className="fade-up">
      <SectionLabel title="Review & confirm" subtitle="One last look — then we'll lock in your booking." />
      <div className="bg-ink-50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-400">Booking summary</span>
          <Pill tone="mint">{state.mode === "monthly" ? "Monthly Plan" : "Hourly"}</Pill>
        </div>
        <SummaryRow icon="broom"    label="Service"  value={`${breakdown.serviceName}${state.materials?" · with materials":""}`} onEdit={() => goTo(0)} />
        <SummaryRow icon="calendar" label="Date"     value={fmtDate}                                                             onEdit={() => goTo(1)} />
        <SummaryRow icon="clock"    label="Time"     value={state.time ? `${state.time} · ${breakdown.hours}h · ${breakdown.maids} maid${breakdown.maids>1?"s":""}` : null} onEdit={() => goTo(2)} />
        <SummaryRow icon="user"     label="Customer" value={[state.name, state.phone].filter(Boolean).join(" · ")}               onEdit={() => goTo(3)} />
        <SummaryRow icon="pin"      label="Location" value={state.address}                                                       onEdit={() => goTo(3)} />
      </div>
    </div>
  );
};

/* ────────────── STEP 6: Success ────────────── */
const StepSuccess = ({ state, breakdown, bookingId, onReset }) => {
  const fmtDate = state.date ? state.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "—";
  return (
    <div className="fade-up text-center max-w-md mx-auto py-4">
      <div className="w-20 h-20 rounded-full bg-mint-500 text-white grid place-items-center mx-auto shadow-mint mb-4">
        <Icon name="check" className="w-10 h-10" strokeWidth={2.5} />
      </div>
      <div className="text-[11px] font-mono uppercase tracking-widest text-mint-700">Booking confirmed</div>
      <h2 className="mt-2 text-[28px] font-bold text-ink-900 tracking-tight">You're all set, {state.name?.split(" ")[0] || "friend"}!</h2>
      <p className="mt-2 text-[14px] text-ink-500">Confirmation sent to <span className="text-ink-800 font-semibold">{state.phone || "your number"}</span>.</p>

      <div className="mt-5 bg-ink-50 rounded-2xl p-4 text-left">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10.5px] font-mono uppercase text-ink-400">Reference</div>
            <div className="text-[22px] font-mono font-bold text-ink-900 tracking-wider">{bookingId}</div>
          </div>
          <Pill tone="mint">{breakdown.serviceName}</Pill>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div><div className="text-ink-400 font-mono text-[10px] uppercase mb-0.5">Total</div><div className="font-bold text-ink-900"><Money value={breakdown.total}/></div></div>
          <div><div className="text-ink-400 font-mono text-[10px] uppercase mb-0.5">When</div><div className="font-medium text-ink-900">{fmtDate}{state.time?` · ${state.time}`:""}</div></div>
          <div className="col-span-2"><div className="text-ink-400 font-mono text-[10px] uppercase mb-0.5">Where</div><div className="font-medium text-ink-900 truncate">{state.address||"—"}</div></div>
        </div>
      </div>

      <div className="mt-5 flex gap-3 justify-center">
        <PrimaryButton onClick={onReset} className="px-6">Book another visit</PrimaryButton>
        <GhostButton>View receipt</GhostButton>
      </div>
    </div>
  );
};

export { StepService, StepDate, StepTime, StepLocation, StepConfirm, StepSuccess };

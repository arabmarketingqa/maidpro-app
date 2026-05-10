/* All 6 steps */

/* ────────────── STEP 1: Service ────────────── */
const DAY_LETTERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CustomMonthlyConfig = ({ state, set }) => {
  const days = state.customDays || 4;
  const maids = state.customMaids || 1;
  const hours = state.customHours || 4;
  const rate = (typeof natRate === "function") ? natRate(state) : 15;
  const subtotal = rate * hours * maids * days * 4;
  const discount = Math.round(subtotal * 0.10);
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
      <div className="grid grid-cols-3 gap-3">
        <BigCounter label="Days / week" value={days} onChange={v => set({ customDays: v })}
          min={1} max={7} suffix={days === 1 ? "day" : "days"} />
        <BigCounter label="Maids needed" value={maids} onChange={v => set({ customMaids: v })}
          min={1} max={4} suffix={maids === 1 ? "maid" : "maids"} />
        <BigCounter label="Hours / day" value={hours} onChange={v => set({ customHours: v })}
          min={2} max={10} suffix="hours" />
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
            <span className="ml-2 text-mint-700 font-semibold">−10% off</span>
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

const StepService = ({ state, set }) => {
  return (
    <div className="fade-up">
      <SectionLabel title="Choose Service" subtitle="Hourly visit, monthly package, or stay-in maid" />

      {/* Mode tabs */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { id: "hourly",  label: "Hourly",   emoji: "⏱️" },
          { id: "monthly", label: "Monthly",  emoji: "🗓️" },
          { id: "stayin",  label: "Stay-In",  emoji: "🏠" },
        ].map(t => {
          const active = state.mode === t.id;
          return (
            <button key={t.id} onClick={() => set({ mode: t.id })}
              className={`h-12 rounded-xl text-[13.5px] font-bold inline-flex items-center justify-center gap-1.5 transition-all
                ${active ? "bg-ink-900 text-white shadow-card" : "bg-ink-50 text-ink-700 hover:bg-ink-100"}`}>
              <span className="text-[16px]">{t.emoji}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Maid Nationality — always visible */}
      <div className="mb-5">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-500 mb-2">Maid nationality</div>
        <div className="grid grid-cols-2 gap-2">
          {NATIONALITIES.map(n => {
            const active = state.nationality === n.id;
            return (
              <button key={n.id} onClick={() => set({ nationality: n.id })}
                className={`min-h-12 px-3 py-2 rounded-xl text-[13px] sm:text-[13.5px] font-semibold flex flex-wrap items-center gap-x-2 gap-y-0.5 transition-all
                  ${active ? "bg-mint-50 ring-2 ring-mint-500 text-ink-900" : "bg-white hairline text-ink-700 hover:bg-ink-50"}`}>
                <span className="text-[18px] leading-none shrink-0">{n.flag}</span>
                <span className="flex-1 text-left min-w-0 truncate">{n.name}</span>
                <span className={`font-mono tabular-nums text-[11.5px] sm:text-[12.5px] whitespace-nowrap basis-full sm:basis-auto text-left sm:text-right ${active ? "text-mint-700" : "text-ink-500"}`}>
                  {n.rate} QAR/hr
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Service type cards — hourly only */}
      {state.mode === "hourly" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {SERVICE_TYPES.map(t => {
            const active = state.serviceType === t.id;
            return (
              <button key={t.id} onClick={() => set({ serviceType: t.id })}
                className={`group relative text-center p-5 rounded-2xl transition-all
                  ${active ? "bg-mint-50 ring-2 ring-mint-500" : "bg-white hairline hover:bg-ink-50"}`}>
                {active && (
                  <span className="absolute top-3 right-3 text-mint-700">
                    <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
                  </span>
                )}
                <div className="text-[34px] leading-none mb-2">{t.emoji}</div>
                <div className="font-bold text-ink-900 text-[15.5px]">{t.name}</div>
                <div className="text-[13px] font-semibold text-mint-700 mt-1">{t.rate} QAR/hr</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Hourly counters */}
      {state.mode === "hourly" && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <BigCounter
            label="Minimum Hours (4+)"
            value={state.hours}
            onChange={v => set({ hours: v })}
            min={2} max={12}
            suffix="hours"
          />
          <BigCounter
            label="Number of Maids"
            value={state.maids}
            onChange={v => set({ maids: v })}
            min={1} max={4}
            suffix={state.maids === 1 ? "maid" : "maids"}
          />
        </div>
      )}

      {/* Monthly package — stacked rows */}
      {state.mode === "monthly" && (
        <div className="space-y-2.5 mb-3">
          {MONTHLY_PACKAGES.map(p => {
            const active = state.packageId === p.id;
            const isCustom = p.custom;
            return (
              <div key={p.id}>
                <button onClick={() => set({ packageId: p.id })}
                  className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-4
                    ${active ? "bg-mint-50 ring-2 ring-mint-500" : "bg-white hairline hover:bg-ink-50"}`}>
                  <div className={`w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 text-[20px]
                    ${active ? "bg-mint-500" : "bg-ink-50"}`}>
                    <span className={active ? "saturate-200" : ""}>{p.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-bold text-ink-900 text-[15px]">{p.name}</div>
                      {p.popular && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Popular</span>
                      )}
                    </div>
                    <div className="text-[12.5px] text-ink-500 mt-0.5">
                      {isCustom
                        ? "Customize your own schedule"
                        : `${p.maids} maid${p.maids > 1 ? "s" : ""} · ${p.daysPerWeek} days/week · ${p.hoursPerDay} hrs/day`}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {isCustom ? (
                      <div className="text-mint-700 font-bold text-[15px]">Custom</div>
                    ) : (
                      <>
                        <div className="font-mono tabular-nums font-bold text-mint-700 text-[16px]">{p.priceMonthly.toLocaleString()} QAR</div>
                        <div className="text-[11px] text-ink-400 -mt-0.5">/month</div>
                      </>
                    )}
                  </div>
                </button>

                {/* Custom configurator — inline expands when selected */}
                {isCustom && active && (
                  <CustomMonthlyConfig state={state} set={set} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stay-In packages — stacked rows */}
      {state.mode === "stayin" && (
        <div className="space-y-2.5 mb-3">
          <div className="p-3 rounded-xl bg-mint-50 ring-1 ring-mint-200 text-[12.5px] text-ink-700">
            <span className="font-bold text-mint-800">Stay-in maid</span> · lives at your home full-time. Includes accommodation, meals, and rest periods per Qatar labour law.
          </div>
          {STAYIN_PACKAGES.map(p => {
            const active = state.stayInId === p.id;
            const monthly = Math.round(p.price / p.months);
            return (
              <button key={p.id} onClick={() => set({ stayInId: p.id })}
                className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-4
                  ${active ? "bg-mint-50 ring-2 ring-mint-500" : "bg-white hairline hover:bg-ink-50"}`}>
                <div className={`w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 text-[20px]
                  ${active ? "bg-mint-500" : "bg-ink-50"}`}>
                  <span>{p.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-bold text-ink-900 text-[15px]">{p.name}</div>
                    {p.popular && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Popular</span>
                    )}
                    {p.save > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-mint-100 text-mint-800">Save {p.save.toLocaleString()} QAR</span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-ink-500 mt-0.5">
                    Live-in maid · ~{monthly.toLocaleString()} QAR / month equivalent
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono tabular-nums font-bold text-mint-700 text-[16px]">{p.price.toLocaleString()} QAR</div>
                  <div className="text-[11px] text-ink-400 -mt-0.5">total</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {/* Materials toggle */}
      {state.mode !== "stayin" && (
      <label className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all
        ${state.materials ? "bg-mint-50 ring-2 ring-mint-500" : "bg-white hairline hover:bg-ink-50"}`}>
        <span className={`w-6 h-6 rounded-md grid place-items-center flex-shrink-0 transition-colors
          ${state.materials ? "bg-mint-500 text-white" : "bg-white hairline text-transparent"}`}>
          <Icon name="check" className="w-4 h-4" strokeWidth={3} />
        </span>
        <input type="checkbox" className="sr-only" checked={state.materials} onChange={e => set({ materials: e.target.checked })} />
        <div className="flex-1">
          <div className="font-bold text-ink-900 text-[14.5px]">I need cleaning materials</div>
          <div className="text-[12.5px] text-ink-500 mt-0.5">Mop, bucket, detergents &amp; supplies · +10 QAR/hr extra</div>
        </div>
      </label>
      )}
    </div>
  );
};

/* ────────────── STEP 2: Date ────────────── */
const Calendar = ({ value, onChange }) => {
  const today = new Date();
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

  // Demo: a few days are "fully booked" — deterministic by date
  const isFullyBooked = (d) => {
    if (!d) return false;
    const t = new Date(d); t.setHours(0,0,0,0);
    if (t < today) return false;
    const days = Math.floor((t - today) / 86400000);
    return [3, 7, 12, 18].includes(days);
  };

  return (
    <div className="bg-white rounded-xl2 hairline p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-ink-900 text-[16px]">{monthLabel}</div>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} className="w-9 h-9 rounded-lg hover:bg-ink-100 grid place-items-center text-ink-700"><Icon name="arrow-left" className="w-4 h-4" /></button>
          <button onClick={() => shift(1)} className="w-9 h-9 rounded-lg hover:bg-ink-100 grid place-items-center text-ink-700"><Icon name="arrow-right" className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["S","M","T","W","T","F","S"].map((d,i) => (
          <div key={i} className="text-center text-[11px] font-mono uppercase text-ink-500 tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const past = d < today;
          const booked = isFullyBooked(d);
          const isToday = sameDay(d, today);
          const sel = sameDay(d, value);
          const disabled = past || booked;
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onChange(d)}
              title={booked ? "Fully booked" : ""}
              className={`aspect-square rounded-lg text-[14px] font-medium relative transition-all
                ${sel ? "bg-mint-500 text-white shadow-mint"
                      : past ? "text-ink-300 cursor-not-allowed"
                      : booked ? "text-ink-300 bg-ink-50 cursor-not-allowed line-through"
                      : "text-ink-800 hover:bg-mint-50"}`}
            >
              {d.getDate()}
              {isToday && !sel && !booked && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-mint-500"></span>}
              {booked && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-tight text-ink-400">Full</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 text-[11px] text-ink-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-mint-500"></span> Selected</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-ink-100"></span> Fully booked</span>
      </div>
    </div>
  );
};

const StepDate = ({ state, set }) => {
  return (
    <div className="fade-up">
      <SectionLabel step={2} total={6} title="When should we arrive?" subtitle="Pick any upcoming day. We'll lock in availability after you choose a time slot." />
      <Calendar value={state.date} onChange={(d) => set({ date: d })} />
    </div>
  );
};

/* ────────────── STEP 3: Time ────────────── */
const TIME_GROUPS = [
  {
    label: "Morning",
    slots: [
      { t: "8:00 AM",  h: 8  },
      { t: "9:00 AM",  h: 9  },
      { t: "10:00 AM", h: 10 },
      { t: "11:00 AM", h: 11 },
      { t: "12:00 PM", h: 12 },
    ],
  },
  {
    label: "Afternoon",
    slots: [
      { t: "1:00 PM", h: 13 },
      { t: "2:00 PM", h: 14 },
      { t: "3:00 PM", h: 15 },
      { t: "4:00 PM", h: 16 },
      { t: "5:00 PM", h: 17 },
      { t: "6:00 PM", h: 18 },
      { t: "7:00 PM", h: 19 },
    ],
  },
];
const StepTime = ({ state, set }) => {
  const now = new Date();
  const today = new Date(); today.setHours(0,0,0,0);
  const sel = state.date ? new Date(state.date) : today;
  sel.setHours(0,0,0,0);
  const isToday = sel.getTime() === today.getTime();
  const cutoffHour = now.getHours() + 1; // need at least 1hr lead time

  return (
    <div className="fade-up">
      <SectionLabel title="Pick a time slot" subtitle="Choose any available start time below." />

      <div className="space-y-5">
        {TIME_GROUPS.map(g => (
          <div key={g.label}>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-500 mb-2">
              {g.label}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {g.slots.map(({ t, h }) => {
                const active = state.time === t;
                const past = isToday && h <= cutoffHour;
                return (
                  <button
                    key={t}
                    disabled={past}
                    onClick={() => set({ time: t })}
                    className={`h-[64px] rounded-xl flex flex-col items-center justify-center gap-1 transition-all
                      ${active ? "bg-mint-500 text-white shadow-mint"
                        : past ? "bg-ink-100 text-ink-300 cursor-not-allowed"
                        : "bg-white hairline text-ink-900 hover:bg-mint-50"}`}>
                    <span className="font-mono text-[14px] font-bold tabular-nums">{t}</span>
                    <span className={`text-[10.5px] font-semibold ${active ? "text-white/80" : past ? "text-ink-400" : "text-mint-700"}`}>
                      {past ? "Not Available" : "Available"}
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
    <div className="fade-up">
      <SectionLabel step={4} total={6} title="Where are we headed?" subtitle="We've pinned your live location. Confirm the full address and add any notes for the team." />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Map */}
        <div className="relative rounded-xl2 overflow-hidden hairline aspect-[4/3] lg:aspect-auto lg:min-h-[360px] map-stripes">
          {/* fake roads */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
            <path d="M0 90 L400 110" stroke="oklch(0.85 0.04 168)" strokeWidth="6" fill="none" />
            <path d="M0 220 L400 200" stroke="oklch(0.85 0.04 168)" strokeWidth="4" fill="none" />
            <path d="M120 0 L140 300" stroke="oklch(0.85 0.04 168)" strokeWidth="5" fill="none" />
            <path d="M280 0 L260 300" stroke="oklch(0.85 0.04 168)" strokeWidth="3" fill="none" />
          </svg>
          {/* Pin */}
          <div className="absolute" style={{ left: `${coords.x}%`, top: `${coords.y}%`, transform: "translate(-50%,-100%)" }}>
            <div className="relative">
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-mint-500/20 pulse-ring"></div>
              <div className="relative w-10 h-10 rounded-full bg-mint-500 grid place-items-center text-white shadow-mint">
                <Icon name="pin" className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Locate me button */}
          <div className="absolute top-3 left-3">
            <button
              onClick={detectLocation}
              className="bg-white/95 backdrop-blur hairline rounded-full pl-3 pr-3.5 h-9 inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink-800 hover:bg-ink-50 shadow-card"
            >
              {locStatus === "locating" ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-mint-500 border-t-transparent animate-spin"></span>
              ) : (
                <Icon name="pin" className="w-3.5 h-3.5 text-mint-700" />
              )}
              {locStatus === "locating" ? "Locating…" : "Locate me"}
            </button>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="bg-white/95 backdrop-blur hairline rounded-lg px-3 py-1.5 text-[12px] font-mono text-ink-700">
              {geo ? `${geo.lat.toFixed(4)}° N · ${geo.lng.toFixed(4)}° E` : "—"}
            </div>
            <div className="bg-white/95 backdrop-blur hairline rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-ink-500">
              MAP PLACEHOLDER
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl2 hairline p-5 space-y-4">
          <Field label="Full name" hint="Required">
            <TextInput
              icon="user"
              placeholder="Aisha Rahman"
              value={state.name || ""}
              onChange={e => set({ name: e.target.value })}
            />
          </Field>
          <Field label="Contact number" hint="We'll send the booking SMS">
            <TextInput
              icon="phone"
              placeholder="+974 5512 4488"
              value={state.phone || ""}
              onChange={e => set({ phone: e.target.value })}
            />
          </Field>
          <Field label="Full address" hint="Required">
            <TextInput
              icon="pin"
              placeholder="Building, street, zone, city"
              value={state.address || ""}
              onChange={e => set({ address: e.target.value })}
            />
          </Field>
          <Field label="Notes for the team" optional>
            <textarea
              rows={4}
              placeholder="Lift code, parking, pets, allergies, etc."
              value={state.notes || ""}
              onChange={e => set({ notes: e.target.value })}
              className="w-full p-3.5 rounded-xl bg-white hairline text-[14px] text-ink-900 placeholder:text-ink-400 focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)] outline-none transition-shadow resize-none"
            />
          </Field>
        </div>
      </div>
    </div>
  );
};

/* ────────────── STEP 5: Confirm ────────────── */
const SummaryRow = ({ icon, label, value, onEdit }) => (
  <div className="flex items-start gap-3 py-3 border-b border-ink-200/70 last:border-0">
    <div className="w-9 h-9 rounded-lg bg-mint-50 text-mint-700 grid place-items-center flex-shrink-0">
      <Icon name={icon} className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[11px] font-mono uppercase tracking-wider text-ink-500">{label}</div>
      <div className="text-[14px] text-ink-900 font-medium truncate">{value || "—"}</div>
    </div>
    {onEdit && (
      <button onClick={onEdit} className="text-[12px] font-semibold text-mint-700 hover:text-mint-800 px-2 py-1 rounded-md hover:bg-mint-50">
        Edit
      </button>
    )}
  </div>
);

const StepConfirm = ({ state, set, breakdown, goTo }) => {
  const fmtDate = state.date ? state.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : null;

  return (
    <div className="fade-up">
      <SectionLabel step={5} total={6} title="Review & confirm" subtitle="One last look. We'll text the team lead's name and ETA 30 minutes before arrival." />

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white rounded-xl2 hairline p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-500">Booking summary</div>
            <Pill tone="mint">{state.mode === "monthly" ? "Monthly Plan" : "Hourly"}</Pill>
          </div>
          <SummaryRow icon="broom" label="Service" value={`${breakdown.serviceName}${state.materials ? " · with materials" : ""}`} onEdit={() => goTo(0)} />
          <SummaryRow icon="calendar" label="Date" value={fmtDate} onEdit={() => goTo(1)} />
          <SummaryRow icon="clock" label="Time" value={state.time ? `${state.time} · ${breakdown.hours} hr${breakdown.hours>1?"s":""} · ${breakdown.maids} maid${breakdown.maids>1?"s":""}` : null} onEdit={() => goTo(2)} />
          <SummaryRow icon="user" label="Customer" value={[state.name, state.phone].filter(Boolean).join(" · ")} onEdit={() => goTo(3)} />
          <SummaryRow icon="pin" label="Location" value={state.address} onEdit={() => goTo(3)} />
        </div>
      </div>
    </div>
  );
};

/* ────────────── STEP 6: Success ────────────── */
const StepSuccess = ({ state, breakdown, bookingId, onReset }) => {
  const fmtDate = state.date ? state.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "—";
  return (
    <div className="fade-up">
      <div className="text-center max-w-xl mx-auto pt-2">
        <div className="relative inline-block">
          <div className="absolute inset-0 rounded-full bg-mint-500/10 pulse-ring"></div>
          <div className="relative w-20 h-20 rounded-full bg-mint-500 text-white grid place-items-center mx-auto shadow-mint">
            <Icon name="check" className="w-10 h-10" strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-6 text-[11px] font-mono uppercase tracking-[0.18em] text-mint-700">Booking confirmed</div>
        <h2 className="mt-2 text-[34px] sm:text-[40px] leading-[1.05] font-bold text-ink-900 tracking-tight">
          You're all set, {state.name?.split(" ")[0] || "friend"}.
        </h2>
        <p className="mt-3 text-[15px] text-ink-600">
          A confirmation has been sent to <span className="text-ink-800 font-medium">{state.phone || "your number"}</span>.
          The team lead will message you 30 minutes before arrival.
        </p>

        <div className="mt-7 bg-white rounded-xl2 hairline p-5 text-left">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-500">Booking reference</div>
              <div className="mt-1 text-[24px] font-mono font-semibold text-ink-900 tracking-wider">{bookingId}</div>
            </div>
            <button className="h-9 px-3 rounded-lg hairline bg-white text-[12.5px] font-semibold text-ink-700 hover:bg-ink-50">
              Copy
            </button>
          </div>
          <div className="my-4 border-t border-dashed border-ink-200"></div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[13.5px]">
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-500">Service</div>
              <div className="text-ink-900 font-medium">{breakdown.serviceName}</div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-500">Total</div>
              <div className="text-ink-900 font-semibold"><Money value={breakdown.total} /></div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-500">When</div>
              <div className="text-ink-900 font-medium">{fmtDate}{state.time ? ` · ${state.time}` : ""}</div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-500">Where</div>
              <div className="text-ink-900 font-medium truncate">{state.address || "—"}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <PrimaryButton onClick={onReset} className="px-6">Book another visit</PrimaryButton>
          <GhostButton>View receipt</GhostButton>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { StepService, StepDate, StepTime, StepLocation, StepConfirm, StepSuccess });

/* App shell + step routing + Tweaks */

const STEPS = [
  { id: "service", label: "Service" },
  { id: "date",    label: "Date" },
  { id: "time",    label: "Time" },
  { id: "place",   label: "Location" },
  { id: "confirm", label: "Confirm" },
];

const initialState = () => {
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  return {
    mode: "hourly",
    serviceType: "regular",
    hours: 3,
    maids: 1,
    materials: false,
    packageId: "standard",
    stayInId: "si3",
    nationality: "philippines",
    customMaids: 1,
    customDays: 4,
    customHours: 4,
    specificDays: false,
    specificDayList: [],
    date: tomorrow,
    timePeriod: "morning",
    time: "8:00 AM",
    search: "",
    address: "",
    unit: "",
    zone: "",
    notes: "",
    name: "",
    phone: "",
    agree: false,
  };
};

function makeBookingId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "MP-";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const Stepper = ({ steps = STEPS, idx, onJump, maxReached }) => (
  <ol className="flex items-start justify-between w-full">
    {steps.map((s, i) => {
      const done = i < idx;
      const active = i === idx;
      const reachable = i <= maxReached;
      return (
        <React.Fragment key={s.id}>
          <li className="flex flex-col items-center min-w-0 flex-shrink-0">
            <button
              disabled={!reachable}
              onClick={() => reachable && onJump(i)}
              className={`flex flex-col items-center gap-1.5 ${reachable ? "cursor-pointer" : "cursor-not-allowed"}`}
            >
              <span className={`w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold transition-all
                ${active ? "bg-mint-700 text-white"
                  : done ? "bg-mint-500 text-white"
                  : "bg-white hairline text-ink-400"}`}>
                {done ? <Icon name="check" className="w-4 h-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-[10.5px] font-bold tracking-[0.12em] uppercase
                ${active ? "text-ink-900" : done ? "text-ink-700" : "text-ink-400"}`}>
                {s.label}
              </span>
            </button>
          </li>
          {i < STEPS.length - 1 && (
            <li className="flex-1 h-px bg-ink-200 relative overflow-hidden mt-[18px] mx-1">
              <span className={`absolute inset-y-0 left-0 bg-mint-500 transition-all duration-300 ${i < idx ? "w-full" : "w-0"}`}></span>
            </li>
          )}
        </React.Fragment>
      );
    })}
  </ol>
);

const Header = ({ idx, total, onJump, maxReached }) => (
  <header className="sticky top-0 z-20 bg-surface/85 backdrop-blur border-b border-ink-200/70">
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 sm:gap-8">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-mint-500 text-white grid place-items-center shadow-mint">
          <Icon name="sparkle-fill" className="w-4 h-4" />
        </div>
        <div className="font-bold tracking-tight text-ink-900 text-[16px]">Maid<span className="text-mint-700">Pro</span></div>
      </div>
      {!isSuccess && (
        <div className="flex-1 max-w-2xl">
          <Stepper idx={idx} onJump={onJump} maxReached={maxReached} />
        </div>
      )}
      <div className="flex-shrink-0 hidden sm:flex items-center gap-2 text-[12px] text-ink-500">
        <Icon name="phone" className="w-3.5 h-3.5" />
        <span className="font-mono">+974 4040 7070</span>
      </div>
    </div>
  </header>
);

/* ─── Mobile collapsible price bar ─── */
const MobilePriceBar = ({ breakdown, onPrimary, primaryLabel, primaryDisabled }) => (
  <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-ink-200 px-4 py-3 flex items-center gap-3">
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-500">Total</div>
      <div className="text-[20px] font-bold text-ink-900 leading-none mt-0.5"><Money value={breakdown.total} /></div>
    </div>
    <PrimaryButton onClick={onPrimary} disabled={primaryDisabled} className="ml-auto">
      {primaryLabel}
      <Icon name="arrow-right" className="w-4 h-4" />
    </PrimaryButton>
  </div>
);

/* ─── Tweaks ─── */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "mint",
  "accentHex": "#3FB28A",
  "density": "comfortable",
  "showPriceCard": true
}/*EDITMODE-END*/;

function applyAccent(accent) {
  const map = {
    mint:    { 50:"oklch(0.985 0.012 168)", 100:"oklch(0.96 0.03 168)", 500:"oklch(0.72 0.13 168)", 600:"oklch(0.62 0.13 168)", 700:"oklch(0.52 0.11 168)", 800:"oklch(0.40 0.08 168)" },
    coral:   { 50:"oklch(0.985 0.012 28)",  100:"oklch(0.96 0.03 28)",  500:"oklch(0.72 0.14 28)",  600:"oklch(0.62 0.14 28)",  700:"oklch(0.52 0.12 28)",  800:"oklch(0.40 0.10 28)" },
    indigo:  { 50:"oklch(0.985 0.012 268)", 100:"oklch(0.96 0.03 268)", 500:"oklch(0.62 0.14 268)", 600:"oklch(0.55 0.14 268)", 700:"oklch(0.46 0.13 268)", 800:"oklch(0.36 0.10 268)" },
    sand:    { 50:"oklch(0.985 0.012 80)",  100:"oklch(0.96 0.03 80)",  500:"oklch(0.74 0.10 80)",  600:"oklch(0.62 0.10 80)",  700:"oklch(0.50 0.09 80)",  800:"oklch(0.38 0.07 80)" },
  };
  const c = map[accent] || map.mint;
  const root = document.documentElement;
  // reassign tailwind tokens via CSS vars + inject style override
  let s = document.getElementById("__accent-override");
  if (!s) { s = document.createElement("style"); s.id = "__accent-override"; document.head.appendChild(s); }
  s.textContent = `
    .bg-mint-500 { background-color: ${c[500]} !important; }
    .bg-mint-400 { background-color: ${c[500]} !important; filter: brightness(1.06); }
    .bg-mint-600 { background-color: ${c[600]} !important; }
    .bg-mint-50  { background-color: ${c[50]} !important; }
    .bg-mint-100 { background-color: ${c[100]} !important; }
    .text-mint-700 { color: ${c[700]} !important; }
    .text-mint-800 { color: ${c[800]} !important; }
    .text-mint-500 { color: ${c[500]} !important; }
    .ring-mint-500 { --tw-ring-color: ${c[500]} !important; }
    .border-mint-500 { border-color: ${c[500]} !important; }
    .shadow-mint { box-shadow: 0 8px 24px -12px ${c[500]} !important; }
  `;
}

function App() {
  const [state, setState] = React.useState(initialState);
  const initStep = (() => {
    try {
      const m = new URLSearchParams(window.location.search).get("step");
      const n = parseInt(m, 10);
      if (!isNaN(n) && n >= 0 && n <= 5) return n;
    } catch (_) {}
    return 0;
  })();
  const [idx, setIdx] = React.useState(initStep);
  const [maxReached, setMaxReached] = React.useState(initStep);
  const [bookingId, setBookingId] = React.useState(initStep === 5 ? "MP-X7K9PM" : null);
  const [tweaks, setTweak] = (typeof useTweaks !== 'undefined') ? useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  React.useEffect(() => { applyAccent(tweaks.accent); }, [tweaks.accent]);

  const set = (patch) => setState(s => ({ ...s, ...patch }));
  const breakdown = computePrice(state);

  // Steps shown depend on mode — monthly skips Date + Time
  const visibleSteps = (state.mode === "monthly" || state.mode === "stayin")
    ? [STEPS[0], STEPS[3], STEPS[4]]
    : STEPS;
  const stepKey = visibleSteps[idx]?.id;

  // Validation per current step (by id, not index)
  const canAdvance = (() => {
    if (stepKey === "service") return !!state.serviceType;
    if (stepKey === "date")    return !!state.date;
    if (stepKey === "time")    return !!state.time;
    if (stepKey === "place")   return (state.address || "").trim().length > 4
      && (state.name || "").trim().length >= 2
      && (state.phone || "").replace(/\D/g,"").length >= 7;
    if (stepKey === "confirm") return true;
    return false;
  })();

  const goNext = () => {
    if (stepKey === "confirm") {
      setBookingId(makeBookingId());
      setIdx(visibleSteps.length); // success state
      return;
    }
    const next = Math.min(idx + 1, visibleSteps.length - 1);
    setIdx(next);
    setMaxReached(m => Math.max(m, next));
  };

  const goBack = () => setIdx(i => Math.max(0, i - 1));
  const goTo = (i) => { if (i <= maxReached) setIdx(i); };
  const reset = () => { setState(initialState()); setIdx(0); setMaxReached(0); setBookingId(null); };

  // Reset idx when mode flips so we don't land on a hidden step
  React.useEffect(() => {
    setIdx(0); setMaxReached(0);
  }, [state.mode]);

  const labelMap = {
    service: (state.mode === "monthly" || state.mode === "stayin") ? "Continue to location" : "Continue to date",
    date:    "Continue to time",
    time:    "Continue to location",
    place:   "Review booking",
    confirm: "Confirm & book",
  };
  const isSuccess = idx >= visibleSteps.length;
  const showPrice = tweaks.showPriceCard !== false && !isSuccess;
  const density = tweaks.density === "compact" ? "py-6" : "py-10";

  return (
    <div className="min-h-dvh py-6 sm:py-10 px-4 sm:px-6">
      <div className="max-w-[760px] mx-auto">
        {/* Brand pill above card */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white text-mint-700 grid place-items-center shadow-card">
              <Icon name="sparkle-fill" className="w-4 h-4" />
            </div>
            <div className="font-extrabold tracking-tight text-white text-[18px]">Maid<span className="text-mint-200">Pro</span></div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[12px] text-white/80">
            <Icon name="phone" className="w-3.5 h-3.5" />
            <span className="font-mono">+974 4040 7070</span>
          </div>
        </div>

        {/* Main white card */}
        <div className="bg-white rounded-3xl shadow-float overflow-hidden">
          {!isSuccess && (
            <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-2">
              <Stepper steps={visibleSteps} idx={idx} onJump={goTo} maxReached={maxReached} />
            </div>
          )}

          <div className="px-5 sm:px-8 py-6 sm:py-8" data-screen-label={`0${idx+1} ${visibleSteps[idx]?.label || "Success"}`}>
            {stepKey === "service" && <StepService  state={state} set={set} />}
            {stepKey === "date"    && <StepDate     state={state} set={set} />}
            {stepKey === "time"    && <StepTime     state={state} set={set} />}
            {stepKey === "place"   && <StepLocation state={state} set={set} />}
            {stepKey === "confirm" && <StepConfirm  state={state} set={set} breakdown={breakdown} goTo={goTo} />}
            {isSuccess             && <StepSuccess  state={state} breakdown={breakdown} bookingId={bookingId} onReset={reset} />}
          </div>

          {!isSuccess && showPrice && (
            <div className="px-5 sm:px-8 pb-6 sm:pb-8">
              <div className="rounded-2xl bg-ink-50 hairline p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500">Live estimate</div>
                  <Pill tone="mint">{state.mode === "monthly" ? "Monthly" : "Hourly"}</Pill>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[34px] leading-none font-extrabold text-ink-900 tracking-tight">
                    <Money value={breakdown.total} />
                  </div>
                  <div className="text-right text-[12px] font-mono text-ink-500 tabular-nums">
                    {state.mode === "monthly" ? (
                      <>{breakdown.rate} QAR × {breakdown.hours} hrs × {breakdown.visits} visits</>
                    ) : (
                      <>{breakdown.rate} QAR × {breakdown.hours} hrs × {breakdown.maids} maid{breakdown.maids>1?"s":""}</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isSuccess && (
            <div className="px-5 sm:px-8 pb-6 sm:pb-8 flex items-center justify-between gap-3 border-t border-ink-200/70 pt-5">
              <GhostButton onClick={goBack} className={idx === 0 ? "invisible" : ""}>
                <Icon name="arrow-left" className="w-4 h-4" />
                Back
              </GhostButton>
              <PrimaryButton onClick={goNext} disabled={!canAdvance} className="px-6">
                {labelMap[stepKey] || "Continue"}
                <Icon name="arrow-right" className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>

      {/* Tweaks panel */}
      {typeof TweaksPanel !== "undefined" && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Aesthetic">
            <TweakColor
              label="Accent"
              value={tweaks.accentHex}
              onChange={(v) => {
                const map = {
                  "#3FB28A": "mint",
                  "#E07A5F": "coral",
                  "#6366F1": "indigo",
                  "#C8A86B": "sand",
                };
                setTweak({ accentHex: v, accent: map[v] || "mint" });
              }}
              options={["#3FB28A", "#E07A5F", "#6366F1", "#C8A86B"]}
            />
            <TweakRadio
              label="Density"
              value={tweaks.density}
              onChange={v => setTweak("density", v)}
              options={["comfortable", "compact"]}
            />
          </TweakSection>
          <TweakSection title="Layout">
            <TweakToggle
              label="Show price card"
              checked={tweaks.showPriceCard !== false}
              onChange={v => setTweak("showPriceCard", v)}
            />
          </TweakSection>
          <TweakSection title="Demo">
            <div className="grid grid-cols-2 gap-2">
              {visibleSteps.concat([{ id: "success", label: "Success" }]).map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (i === 5) setBookingId(makeBookingId());
                    setIdx(i);
                    setMaxReached(m => Math.max(m, i));
                  }}
                  className={`h-9 rounded-lg text-[12px] font-medium hairline ${idx===i ? "bg-mint-500 text-white border-mint-500" : "bg-white text-ink-700 hover:bg-ink-50"}`}
                >
                  {i+1}. {s.label}
                </button>
              ))}
            </div>
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

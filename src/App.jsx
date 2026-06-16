import React from 'react'
import { Icon, Pill, PrimaryButton, GhostButton } from './ui'
import { SvcIcon } from './serviceIcons'
import { computePrice, Money } from './pricing'
import { StepService, StepDate, StepTime, StepLocation, StepConfirm, StepSuccess } from './steps'
import { useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle } from './tweaks-panel'
import { supabase, SETTINGS_SYNC_CHANNEL, SETTINGS_SYNC_KEY } from './supabase'
import { readBookingCache, writeBookingCache, invalidateBookingCache } from './bookingCache'

const toFlag = (s) => s && /^[A-Z]{2}$/i.test(s.trim())
  ? String.fromCodePoint(...[...s.trim().toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
  : (s || '🌍');

const STEPS = [
  { id: "service", label: "Service" },
  { id: "date",    label: "Date" },
  { id: "time",    label: "Time" },
  { id: "place",   label: "Location" },
  { id: "confirm", label: "Confirm" },
];

const localDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const initialState = () => {
  const now = new Date();
  const today = new Date(now); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  // Default to today if the last time slot (7 PM) hasn't passed yet, otherwise tomorrow
  const defaultDate = now.getHours() < 19 ? today : tomorrow;
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
    date: defaultDate,
    timePeriod: "morning",
    time: "",
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

async function makeBookingId() {
  const { data } = await supabase
    .from('bookings').select('ref').order('id', { ascending: false }).limit(1);
  let n = 1;
  if (data?.[0]?.ref) {
    const m = String(data[0].ref).match(/^MP-(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `MP-${String(n).padStart(3, '0')}`;
}

const Stepper = ({ steps = STEPS, idx, onJump, maxReached }) => (
  <ol className="flex items-center justify-between w-full">
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
              className={`flex flex-col items-center gap-1 ${reachable ? "cursor-pointer" : "cursor-not-allowed"}`}
            >
              <span className={`w-8 h-8 rounded-full grid place-items-center text-[13px] font-bold transition-all
                ${active ? "bg-mint-600 text-white shadow-sm"
                  : done ? "bg-mint-500 text-white"
                  : "bg-ink-100 text-ink-400"}`}>
                {done ? <Icon name="check" className="w-4 h-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-[10px] font-bold tracking-[0.1em] uppercase hidden sm:block
                ${active ? "text-ink-900" : done ? "text-ink-600" : "text-ink-300"}`}>
                {s.label}
              </span>
            </button>
          </li>
          {i < steps.length - 1 && (
            <li className="flex-1 h-px bg-ink-200 relative overflow-hidden mt-[16px] mx-1">
              <span className={`absolute inset-y-0 left-0 bg-mint-500 transition-all duration-300 ${i < idx ? "w-full" : "w-0"}`}></span>
            </li>
          )}
        </React.Fragment>
      );
    })}
  </ol>
);

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
  const [bookingError, setBookingError] = React.useState('');
  const [bookingId, setBookingId] = React.useState(initStep === 5 ? "MP-X7K9PM" : null);
  const [submitting, setSubmitting] = React.useState(false);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const limitsApplied = React.useRef(false);
  // Stale-while-revalidate: synchronous localStorage read on every mount
  const _cache = React.useMemo(() => readBookingCache(), []);
  const [liveNats, setLiveNats] = React.useState(() => _cache?.nats ?? null);
  const [liveModes, setLiveModes] = React.useState(() => _cache?.modes ?? null);
  const [liveModesData, setLiveModesData] = React.useState(() => _cache?.modesData ?? null);
  const [liveNatBlockEnabled, setLiveNatBlockEnabled] = React.useState(() => _cache?.natBlockEnabled ?? true);
  const [liveServices, setLiveServices] = React.useState(() => _cache?.services ?? null);
  const [liveMonthly, setLiveMonthly] = React.useState(() => _cache?.monthly ?? null);
  const [liveStayIn, setLiveStayIn] = React.useState(() => _cache?.stayIn ?? null);
  const [liveLimits, setLiveLimits] = React.useState(() => _cache?.limits ?? null);
  const [liveMaterialsRate, setLiveMaterialsRate] = React.useState(() => _cache?.materialsRate ?? null);
  const [liveBrand, setLiveBrand] = React.useState(() => _cache?.brand ?? null);
  const [liveBusinessHours, setLiveBusinessHours] = React.useState(() => _cache?.businessHours ?? { open: 8, close: 19 });
  const [liveAvailability, setLiveAvailability] = React.useState({});
  const [slotData, setSlotData] = React.useState({ bookings: [], availableCount: 0, loading: false });
  const [totalStaffCount, setTotalStaffCount] = React.useState(null);

  // Fetch total staff count once on mount and keep in sync via realtime
  React.useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.from('staff').select('id, active, working_days');
      if (data) {
        setTotalStaffCount(data.filter(s => {
          if (s.active === false) return false;
          const days = s.working_days;
          if (!Array.isArray(days)) return true;  // column not in DB → count them
          if (days.length === 0) return false;     // all days turned off → never works
          return true;
        }).length);
      } else if (error) {
        // working_days or active column not yet in DB — try active only
        const { data: d2, error: e2 } = await supabase.from('staff').select('id, active');
        if (d2) {
          setTotalStaffCount(d2.filter(s => s.active !== false).length);
        } else {
          // both columns missing — count all staff
          const { data: fb } = await supabase.from('staff').select('id');
          if (fb) setTotalStaffCount(fb.length);
        }
      }
    };
    fetch();
    const ch = supabase.channel('staff-count-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, fetch)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);
  // Skeleton only shows on cache miss — cache hit renders the full form instantly
  const [isLoading, setIsLoading] = React.useState(() => !_cache);

  /* Fetch all live settings from Supabase and subscribe to realtime */
  const [availableNatIds, setAvailableNatIds] = React.useState(null);
  const [availableSkillIds, setAvailableSkillIds] = React.useState(null); // skill IDs available for selected nat+mode

  const fetchAvailableSkills = React.useCallback(async (nationality, mode) => {
    if (mode !== 'hourly' || !nationality) { setAvailableSkillIds(null); return; }
    const { data } = await supabase.from('staff').select('skills')
      .eq('nationality', nationality);
    if (!data) return;

    const skillSet = new Set();
    let anyModeConfig = false;

    data.forEach(s => {
      const sk = Array.isArray(s.skills) ? s.skills : [];
      const modeEntries = sk.filter(x => x.startsWith('@'));
      if (modeEntries.length > 0) anyModeConfig = true;
      const hasHourly = modeEntries.map(x => x.slice(1)).includes('hourly');
      if (hasHourly) sk.filter(x => !x.startsWith('@')).forEach(id => skillSet.add(id));
    });

    // No mode config at all → show all services (null means no filter)
    if (!anyModeConfig) { setAvailableSkillIds(null); return; }

    // Has mode config: return skills found (may be empty array if @hourly but no skills)
    setAvailableSkillIds([...skillSet]);
  }, []);

  // Only show nationalities that have ≥1 available maid configured for the given mode
  // For hourly: maid must also have ≥1 skill selected (otherwise they can't take any booking)
  const fetchAvailableNatIds = React.useCallback(async (mode = 'hourly') => {
    const { data } = await supabase.from('staff').select('nationality, skills');
    if (!data) return;

    const anyModeConfig = data.some(s =>
      (Array.isArray(s.skills) ? s.skills : []).some(x => x.startsWith('@'))
    );

    const ids = [...new Set(
      data.filter(s => {
        const sk = Array.isArray(s.skills) ? s.skills : [];
        const modes = sk.filter(x => x.startsWith('@')).map(x => x.slice(1));
        const realSkills = sk.filter(x => !x.startsWith('@'));

        // No mode config at all → show all (admin hasn't set up yet)
        if (!anyModeConfig) return true;

        // Must have this mode enabled
        if (!modes.includes(mode)) return false;

        // Hourly additionally requires at least one skill
        if (mode === 'hourly' && realSkills.length === 0) return false;

        return true;
      }).map(s => s.nationality).filter(Boolean)
    )];

    setAvailableNatIds(ids);
  }, []);

  React.useEffect(() => {
    // ── Pure transforms: process raw DB rows → update state + return value for caching ──
    const applyNats = (rows) => {
      const nats = rows
        .filter(n => n.enabled !== false)
        .map(n => ({ id: n.id, name: n.name, flag: toFlag(n.flag || '🌍'), rate: Number(n.rate) || 15 }));
      setLiveNats(nats);
      return nats;
    };

    const applySettingsMap = (m) => {
      let modes = null, modesData = null, natBlockEnabled = true, services = null, monthly = null;
      let stayIn = null, limits = null, materialsRate = null;
      let businessHours = { open: 8, close: 19 }, brand = null;

      if (m.modes && Array.isArray(m.modes)) {
        modesData = m.modes.filter(x => x.on !== false);
        modes = modesData.map(x => x.id);
        setLiveModes(modes);
        setLiveModesData(modesData);
      } else {
        setLiveModes(null);
        setLiveModesData(null);
      }
      if (m.nationalities_block && typeof m.nationalities_block.enabled === 'boolean') {
        natBlockEnabled = m.nationalities_block.enabled;
        setLiveNatBlockEnabled(natBlockEnabled);
      }
      if (m.services && Array.isArray(m.services) && m.services.length) {
        services = m.services.filter(s => s.on !== false);
        setLiveServices(services);
      }
      if (m.monthly && Array.isArray(m.monthly) && m.monthly.length) {
        const msCfg = m.monthlySettings || {};
        const customEnabled = msCfg.customEnabled !== false;
        const customDiscount = Number(msCfg.customDiscount ?? 10);
        const regularPkgs = m.monthly.filter(x => !x.custom);
        monthly = customEnabled
          ? [...regularPkgs, { id: 'custom', name: 'Custom Package', icon: 'Eraser', emoji: '🧩', custom: true, customDiscount }]
          : regularPkgs;
        setLiveMonthly(monthly);
      }
      if (m.stayIn && Array.isArray(m.stayIn) && m.stayIn.length) {
        const emojiMap = { si1: '🏠', si3: '🗝️', si6: '💎', si12: '👑' };
        stayIn = m.stayIn.map(p => ({ ...p, emoji: p.emoji || emojiMap[p.id] || '🏠' }));
        setLiveStayIn(stayIn);
      }
      if (m.limits && typeof m.limits === 'object') {
        limits = m.limits;
        setLiveLimits(limits);
      }
      if (m.materials && typeof m.materials.rate === 'number') {
        materialsRate = m.materials.rate;
        setLiveMaterialsRate(materialsRate);
      }
      if (m.businessHours && typeof m.businessHours.open === 'number') {
        businessHours = m.businessHours;
        setLiveBusinessHours(businessHours);
      }
      if (m.brand && m.brand.name) {
        brand = m.brand;
        setLiveBrand(m.brand);
      }
      return { modes, modesData, natBlockEnabled, services, monthly, stayIn, limits, materialsRate, businessHours, brand };
    };

    // ── Fetchers used by realtime/polling (update state, no cache write) ──
    const fetchNats = async () => {
      const { data } = await supabase.from('nationalities').select('*').order('name');
      return data ? applyNats(data) : null;
    };

    const fetchSettings = async () => {
      const { data, error } = await supabase.from('settings').select('key, value')
        .in('key', ['modes', 'nationalities_block', 'services', 'monthly', 'monthlySettings', 'stayIn', 'limits', 'materials', 'businessHours', 'brand']);
      if (error) { console.warn('fetchSettings error:', error.message); return null; }
      return data ? applySettingsMap(Object.fromEntries(data.map(r => [r.key, r.value]))) : null;
    };

    const fetchAvailability = async () => {
      const { data } = await supabase.from('availability').select('*');
      if (data && data.length > 0) {
        const avail = {};
        data.forEach(r => { avail[r.date] = { blocked: r.blocked, morning: r.morning, afternoon: r.afternoon }; });
        setLiveAvailability(avail);
      }
    };

    // ── Critical path: nats + settings in parallel, then write to cache ──
    const fetchCritical = () =>
      Promise.all([fetchNats(), fetchSettings()])
        .then(([nats, settings]) => {
          if (nats && settings) writeBookingCache({ nats, ...settings });
        });

    // If cache was a hit, isLoading is already false — fetchCritical runs silently in background.
    // If cache miss, isLoading is true — .finally() dismisses the skeleton once data arrives.
    fetchCritical().catch(() => {}).finally(() => setIsLoading(false));

    // Availability is only needed at the date step — defer out of critical path entirely
    fetchAvailability();
    fetchAvailableNatIds('hourly');

    // ── Supabase Realtime (instant push when enabled on the project) ──
    const ch = supabase.channel('booking-page-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nationalities' }, fetchNats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, fetchSettings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, fetchAvailability)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => fetchAvailableNatIds())
      .subscribe();

    // Polling fallback when Supabase Realtime isn't enabled for the settings table
    const poll = setInterval(fetchSettings, 1500);

    // ── Cross-tab invalidation: admin saves → invalidate cache + refetch ──
    const refetchAfterInvalidation = () => {
      invalidateBookingCache();
      fetchCritical();
      fetchAvailability();
    };

    const onStorage = (e) => {
      if (e.key === SETTINGS_SYNC_KEY) refetchAfterInvalidation();
    };
    window.addEventListener('storage', onStorage);

    let bc = null;
    try {
      bc = new BroadcastChannel(SETTINGS_SYNC_CHANNEL);
      bc.onmessage = (e) => {
        if (e.data?.type === 'settings_updated') refetchAfterInvalidation();
      };
    } catch (_) {}

    // Re-fetch when the booking tab becomes visible (catches offline edits)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchSettings();
        fetchNats();
        fetchAvailability();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
      window.removeEventListener('storage', onStorage);
      if (bc) bc.close();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchAvailableNatIds]);

  React.useEffect(() => {
    if (!liveModes || liveModes.length === 0) return;
    if (!liveModes.includes(state.mode)) {
      set({ mode: liveModes[0] });
    }
  }, [liveModes]);
  React.useEffect(() => {
    if (!liveLimits) return;
    const min = Number(liveLimits.minHours) || 1;
    const max = Number(liveLimits.maxHours) || 12;
    if (!limitsApplied.current) {
      limitsApplied.current = true;
      set({ hours: min });
    } else {
      if (state.hours < min) set({ hours: min });
      if (state.hours > max) set({ hours: max });
    }
  }, [liveLimits]);

  React.useEffect(() => { applyAccent(tweaks.accent); }, [tweaks.accent]);

  // Fetch bookings + available staff whenever the selected date changes
  React.useEffect(() => {
    if (!state.date) return;
    const dateStr = state.date instanceof Date ? localDateStr(state.date) : String(state.date).split('T')[0];
    setSlotData(p => ({ ...p, loading: true }));
    (async () => {
      try {
        const [{ data: bks }, staffRes] = await Promise.all([
          supabase.from('bookings').select('time, hours, cleaners, assigned_staff').eq('date', dateStr).neq('status', 'Cancelled'),
          supabase.from('staff').select('id, working_days, active'),
        ]);
        const dow = new Date(dateStr + 'T00:00:00').getDay();

        let staffList = staffRes.data;
        if (staffRes.error || !staffList) {
          const { data: fallback } = await supabase.from('staff').select('id');
          staffList = (fallback || []).map(s => ({ id: s.id, working_days: null, active: true }));
        }

        const workingStaff = staffList.filter(s => {
          if (s.active === false) return false;       // on-hold staff don't count
          const days = s.working_days;
          if (!Array.isArray(days)) return true;
          if (days.length === 0) return false;
          return days.includes(dow);
        });
        setSlotData({ bookings: bks || [], availableCount: workingStaff.length, workingStaffIds: workingStaff.map(s => s.id), loading: false });
      } catch (e) {
        console.warn('slot fetch error:', e?.message);
        setSlotData({ bookings: [], availableCount: 0, loading: false });
      }
    })();
  }, [state.date]);

  const set = (patch) => setState(s => ({ ...s, ...patch }));

  // When nationalities block is ON, only show nationalities that have ≥1 Available maid
  const filteredNats = React.useMemo(() => {
    if (!liveNats) return liveNats;
    if (!liveNatBlockEnabled) return liveNats; // block OFF → show all
    if (!availableNatIds) return liveNats;     // not loaded yet → show all
    return liveNats.filter(n => availableNatIds.includes(n.id));
  }, [liveNats, liveNatBlockEnabled, availableNatIds]);

  // Re-filter available nationalities whenever booking mode changes
  React.useEffect(() => {
    fetchAvailableNatIds(state.mode || 'hourly');
  }, [state.mode, fetchAvailableNatIds]);

  // Re-fetch available skills when nationality or mode changes
  React.useEffect(() => {
    fetchAvailableSkills(state.nationality, state.mode);
  }, [state.nationality, state.mode, fetchAvailableSkills]);

  // Auto-reset selected nationality if it disappears from the available list
  React.useEffect(() => {
    if (!filteredNats || filteredNats.length === 0) return;
    if (!filteredNats.find(n => n.id === state.nationality)) {
      set({ nationality: filteredNats[0].id });
    }
  }, [filteredNats]);

  // Auto-reset selected service if it's been removed/disabled in the admin
  React.useEffect(() => {
    if (!liveServices || liveServices.length === 0) return;
    if (state.mode !== 'hourly') return;
    if (!liveServices.find(s => s.id === state.serviceType)) {
      set({ serviceType: liveServices[0].id });
    }
  }, [liveServices]);

  const liveData = { services: liveServices, monthly: liveMonthly, stayIn: liveStayIn, materialsRate: liveMaterialsRate, nationalityEnabled: liveNatBlockEnabled };
  const breakdown = computePrice(state, filteredNats || liveNats || undefined, liveData);

  const visibleSteps = (state.mode === "monthly" || state.mode === "stayin")
    ? [STEPS[0], STEPS[3], STEPS[4]]
    : STEPS;
  const stepKey = visibleSteps[idx]?.id;

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

  const goNext = async () => {
    if (stepKey === "confirm") {
      setSubmitting(true);

      // Generate sequential ref; fall back to random if Supabase unreachable
      let id;
      try { id = await makeBookingId(); }
      catch {
        const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        id = "MP-" + Array.from({length:6}, () => c[Math.floor(Math.random()*c.length)]).join('');
      }

      // Pick the N least-busy maids filtered by service mode + skill
      let assigned_staff = [];
      try {
        const needed   = breakdown.maids || 1;
        const mode     = state.mode || 'hourly';
        // Find the skill ID for the selected service (e.g. "Regular Cleaning" → "regular")
        const svcId    = (liveServices || []).find(s => s.name === breakdown.serviceName)?.id;

        const bookingDate = state.date ? localDateStr(state.date) : localDateStr(new Date());
        let staffRes = await supabase.from('staff').select('id, skills, working_days, active');
        let availStaff = staffRes.data;
        if (staffRes.error || !availStaff) {
          const fb = await supabase.from('staff').select('id, skills');
          availStaff = (fb.data || []).map(s => ({ ...s, working_days: null, active: true }));
        }

        if (availStaff && availStaff.length > 0) {
          // 1. Exclude on-hold staff, then filter by service mode
          let pool = availStaff.filter(s => s.active !== false).filter(s => {
            const sk = Array.isArray(s.skills) ? s.skills : [];
            const modes = sk.filter(x => x.startsWith('@')).map(x => x.slice(1));
            return modes.length === 0 || modes.includes(mode);
          });

          // 2. Filter by working day for the booking date
          const bookingDow = new Date(bookingDate + 'T00:00:00').getDay();
          pool = pool.filter(s => {
            const days = s.working_days;
            if (!Array.isArray(days)) return true;
            if (days.length === 0) return false;
            return days.includes(bookingDow);
          });

          // 3. For hourly: filter by skill (exclude @prefix entries when matching)
          if (mode === 'hourly' && svcId) {
            const skilled = pool.filter(s =>
              (Array.isArray(s.skills) ? s.skills : []).filter(x => !x.startsWith('@')).includes(svcId)
            );
            if (skilled.length > 0) pool = skilled;
          }

          if (pool.length > 0) {
            const { data: existingBks } = await supabase.from('bookings').select('assigned_staff').not('assigned_staff', 'is', null);
            const jobCounts = {};
            (existingBks || []).forEach(b => (b.assigned_staff || []).forEach(sid => { jobCounts[sid] = (jobCounts[sid] || 0) + 1; }));
            const sorted = [...pool].sort((a, b) => (jobCounts[a.id] || 0) - (jobCounts[b.id] || 0));
            assigned_staff = sorted.slice(0, needed).map(s => s.id);
          }
        }
      } catch (_) { /* staff table not ready — skip assignment */ }

      const fullRow = {
        ref:            id,
        name:           state.name,
        phone:          state.phone,
        service:        breakdown.serviceName,
        mode:           state.mode || 'hourly',
        date:           state.date ? localDateStr(state.date) : localDateStr(new Date()),
        time:           state.time || '—',
        area:           state.zone || '',
        hours:          breakdown.hours,
        cleaners:       breakdown.maids,
        materials:      state.materials || false,
        rate:           breakdown.rate,
        total:          breakdown.total,
        address:        state.address || '',
        notes:          state.notes  || '',
        status:         'New',
        assigned_staff,
      };

      // Attempt 1 — full row (including assigned_staff)
      let { error } = await supabase.from('bookings').insert(fullRow);

      // Attempt 2 — strip optional newer columns that may not exist in this DB schema yet
      // Keep assigned_staff — it's a core column and must not be lost
      if (error?.code === 'PGRST204') {
        const { area: _b, mode: _c, materials: _d, rate: _e, address: _f, ...coreRow } = fullRow;
        ({ error } = await supabase.from('bookings').insert(coreRow));
      }

      // Attempt 3 — duplicate ref (race condition or deletion gap) → random ref + retry
      if (error?.code === '23505') {
        const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        fullRow.ref = "MP-" + Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join('');
        ({ error } = await supabase.from('bookings').insert(fullRow));
      }

      if (error) {
        console.error('Booking insert error:', error.message);
        setBookingError(error.message || 'Booking could not be saved. Please try again.');
        setSubmitting(false);
        return;                     // stay on confirm — do NOT show success
      }

      // Auto-save customer record (upsert by phone-based id)
      try {
        const custId = 'c_' + (fullRow.phone || '').replace(/\D/g, '').slice(-10);
        await supabase.from('customers').upsert(
          { id: custId, name: fullRow.name, phone: fullRow.phone, address: fullRow.address || '', area: fullRow.area || '' },
          { onConflict: 'id' }
        );
      } catch (_) {}

      setBookingError('');
      setSubmitting(false);
      setBookingId(id);
      setIdx(visibleSteps.length);
      try { window.dispatchEvent(new Event('refreshBookings')); } catch (_) {}
      return;
    }
    const next = Math.min(idx + 1, visibleSteps.length - 1);
    setIdx(next);
    setMaxReached(m => Math.max(m, next));
  };

  const goBack = () => setIdx(i => Math.max(0, i - 1));
  const goTo = (i) => { if (i <= maxReached) setIdx(i); };
  const reset = () => { setState(initialState()); setIdx(0); setMaxReached(0); setBookingId(null); };

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

  if (isLoading) {
    return (
      <div className="h-[100dvh] flex flex-col py-2 px-3 sm:py-3 sm:px-4" style={{ background: 'oklch(0.46 0.07 168)' }}>
        <div className="max-w-[700px] w-full mx-auto flex flex-col h-full">
          {/* Top bar skeleton — same dimensions as the real bar so layout never shifts */}
          <div className="mb-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 animate-pulse flex-shrink-0" />
              <div className="w-28 h-[18px] rounded-md bg-white/20 animate-pulse" />
            </div>
            <div className="w-32 h-[14px] rounded-md bg-white/20 animate-pulse" />
          </div>
          {/* Card skeleton */}
          <div className="bg-white rounded-2xl shadow-float flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-9 h-9 rounded-full border-[3px] border-ink-100 border-t-mint-500 animate-spin" />
              <span className="text-[13px] text-ink-400 font-medium">Loading…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col py-2 px-3 sm:py-3 sm:px-4"
      style={{ background: 'oklch(0.46 0.07 168)' }}>
      <div className="max-w-[700px] w-full mx-auto flex flex-col h-full">

        {/* Top bar */}
        <div className="mb-2 sm:mb-3 flex items-center justify-between flex-shrink-0">
          {/* Logo + company name */}
          <div className="flex items-center gap-2">
            {liveBrand?.logo ? (
              <img src={liveBrand.logo} alt="logo"
                className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5 flex-shrink-0"/>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white text-mint-700 grid place-items-center shadow-card flex-shrink-0">
                <Icon name="sparkle-fill" className="w-4 h-4" />
              </div>
            )}
            <div className="font-extrabold tracking-tight text-white text-[15px] sm:text-[18px]">
              {liveBrand?.name}
            </div>
          </div>
          {/* Brand badge — right side */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 grid place-items-center flex-shrink-0">
              <SvcIcon name="Sparkles" className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
            </div>
            <span className="font-extrabold tracking-[0.14em] text-white text-[13px]">MAIDPRO</span>
          </div>
        </div>

        {/* Card — fills remaining height */}
        <div className="bg-white rounded-2xl shadow-float flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* Stepper */}
          {!isSuccess && (
            <div className="px-4 sm:px-7 pt-3 pb-2 sm:pt-4 sm:pb-3 border-b border-ink-100 flex-shrink-0">
              <Stepper steps={visibleSteps} idx={idx} onJump={goTo} maxReached={maxReached} />
            </div>
          )}

          {/* Step content — scrolls if needed, fills space */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 py-3 sm:py-4"
            data-screen-label={`0${idx+1} ${visibleSteps[idx]?.label || "Success"}`}>
            {stepKey === "service" && <StepService  state={state} set={set} nationalities={filteredNats} enabledModes={liveModes} liveModesData={liveModesData} natsBlockEnabled={liveNatBlockEnabled} liveServices={liveServices} liveMonthly={liveMonthly} liveStayIn={liveStayIn} liveLimits={liveLimits} materialsRate={liveMaterialsRate} totalStaff={totalStaffCount} />}
            {stepKey === "date"    && <StepDate     state={state} set={set} liveLimits={liveLimits} liveAvailability={liveAvailability} />}
            {stepKey === "time"    && <StepTime     state={state} set={set} slotData={slotData} businessHours={liveBusinessHours} />}
            {stepKey === "place"   && <StepLocation state={state} set={set} />}
            {stepKey === "confirm" && <StepConfirm  state={state} set={set} breakdown={breakdown} goTo={goTo} />}
            {isSuccess             && <StepSuccess  state={state} breakdown={breakdown} bookingId={bookingId} onReset={reset} />}
          </div>

          {/* Bottom bar — price + nav */}
          {!isSuccess && (
            <div className="flex-shrink-0 border-t border-ink-100 px-4 sm:px-7 pt-2.5 sm:pt-3 flex items-center gap-2 sm:gap-3"
              style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))' }}>

              {showPrice && (
                <div className="flex-1 flex items-center min-w-0">
                  <div className="text-[18px] sm:text-[22px] font-extrabold text-ink-900 tabular-nums"><Money value={breakdown.total} /></div>
                </div>
              )}

              {bookingError && (
                <div className="text-[12px] text-red-600 font-medium truncate flex-1">⚠ {bookingError}</div>
              )}

              <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                <GhostButton onClick={goBack} className={idx === 0 ? "invisible" : ""}>
                  <Icon name="arrow-left" className="w-4 h-4" />Back
                </GhostButton>
                <PrimaryButton onClick={goNext} disabled={!canAdvance || submitting}>
                  {submitting ? 'Saving…' : (
                    <>
                      <span className="sm:hidden">{stepKey === 'confirm' ? 'Confirm' : 'Continue'}</span>
                      <span className="hidden sm:inline">{labelMap[stepKey] || 'Continue'}</span>
                    </>
                  )}
                  {!submitting && <Icon name="arrow-right" className="w-4 h-4" />}
                </PrimaryButton>
              </div>
            </div>
          )}
        </div>
      </div>

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
                  if (i === 5) makeBookingId().then(setBookingId);
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
    </div>
  );
}

export default App;

import React from 'react'
import { Icon, PrimaryButton } from './ui'

const SERVICE_TYPES = [
  { id: "regular", name: "Regular Cleaning",  icon: "Sparkles", rate: 15, desc: "Routine tidy-up: dusting, mopping, surfaces" },
  { id: "deep",    name: "Deep Cleaning",     icon: "SprayCan",  rate: 15, desc: "Top-to-bottom, including kitchen + baths" },
  { id: "movein",  name: "Move-in / Out",     icon: "Package",   rate: 15, desc: "Empty-property turnover before keys swap" },
  { id: "post",    name: "Post-Construction", icon: "HardHat",   rate: 15, desc: "Dust, debris & paint residue removal" },
];

const HOURLY_BASE_FEE = 0;
const MATERIALS_PER_HOUR = 10;
const MAID_MULTIPLIER = 1;

const MONTHLY_PACKAGES = [
  { id: "basic",    name: "Basic Package",    emoji: "🌿", maids: 1, daysPerWeek: 4, hoursPerDay: 4, priceMonthly: 960 },
  { id: "standard", name: "Standard Package", emoji: "⭐", maids: 1, daysPerWeek: 5, hoursPerDay: 4, priceMonthly: 1200, popular: true },
  { id: "premium",  name: "Premium Package",  emoji: "👑", maids: 2, daysPerWeek: 5, hoursPerDay: 4, priceMonthly: 2400 },
  { id: "custom",   name: "Custom Package",   emoji: "🧩", custom: true },
];

const MONTHLY_RATE_PER_HOUR = 15;
const WEEKS_IN_MONTH = 4;
const MONTHLY_DISCOUNT = 0.10;

const STAYIN_PACKAGES = [
  { id: "si1",  name: "1 Month",   emoji: "🏠", months: 1,  price: 5500 },
  { id: "si3",  name: "3 Months",  emoji: "🗝️", months: 3,  price: 15000, popular: true, save: 1500 },
  { id: "si6",  name: "6 Months",  emoji: "💎", months: 6,  price: 28500, save: 4500 },
  { id: "si12", name: "12 Months", emoji: "👑", months: 12, price: 54000, save: 12000 },
];

const NATIONALITIES = [
  { id: "philippines", name: "Philippines", flag: "🇵🇭", rate: 40 },
  { id: "indian",      name: "Indian",      flag: "🇮🇳", rate: 25 },
  { id: "nepal",       name: "Nepal",       flag: "🇳🇵", rate: 20 },
  { id: "nigeria",     name: "Nigeria",     flag: "🇳🇬", rate: 15 },
];

function natRate(state, natsList) {
  const list = natsList || NATIONALITIES;
  const n = list.find(x => x.id === state.nationality) || list[0];
  return n ? n.rate : 15;
}

function computePrice(state, natsList, liveData) {
  const SVCS    = (liveData?.services && liveData.services.length) ? liveData.services : SERVICE_TYPES;
  const MONTHLY = (liveData?.monthly  && liveData.monthly.length)  ? liveData.monthly  : MONTHLY_PACKAGES;
  const STAYIN  = (liveData?.stayIn   && liveData.stayIn.length)   ? liveData.stayIn   : STAYIN_PACKAGES;
  const MAT_RATE = (liveData?.materialsRate != null) ? Number(liveData.materialsRate) : MATERIALS_PER_HOUR;

  const type       = SVCS.find(t => t.id === state.serviceType) || SVCS[0];
  const natRateVal = natRate(state, natsList);
  const nat        = state.nationality || '';

  // Nationality-specific rate lookup — only applies when the nationality block is ON
  // For hourly: fallback=null → uses natRateVal so price always changes with nationality
  // For monthly/stayin: fallback=packagePrice → uses default package price when no nationality override
  const natPrice = (obj, fallback) => {
    if (!liveData?.nationalityEnabled) return fallback != null ? Number(fallback) : 0;
    const rates = obj?.nationalityRates || obj?.nationalityPrices || {};
    if (rates[nat] != null) return Number(rates[nat]);
    // No per-service nationality rate set — use natRateVal for hourly, package default for monthly/stayin
    return fallback != null ? Number(fallback) : natRateVal;
  };

  // Hourly rate: per-service nationality override → service's own rate → nationality base rate
  const svcRate = natPrice(type, type?.rate ?? natRateVal);

  let hours = state.hours;
  let maids = state.maids;
  let visits = 1;

  if (state.mode === "stayin") {
    const pkg = STAYIN.find(p => p.id === state.stayInId) || STAYIN[0];
    const price = natPrice(pkg, pkg?.price);
    return {
      rate: 0, hours: 24, maids: 1, visits: pkg.months,
      labour: price, materials: 0, subtotal: price,
      monthlyDiscount: Number(pkg.save) || 0,
      total: price,
      serviceName: `Stay-In · ${pkg.name}`,
      months: pkg.months,
    };
  }

  if (state.mode === "monthly") {
    const pkg = MONTHLY.find(p => p.id === state.packageId) || MONTHLY[0];
    if (pkg.custom) {
      maids = state.customMaids || 1;
      const days = state.customDays || 4;
      hours = state.customHours || 4;
      const subtotal = natRateVal * hours * maids * days * WEEKS_IN_MONTH;
      const discountRate = (pkg.customDiscount != null ? Number(pkg.customDiscount) : 10) / 100;
      const monthlyDiscount = Math.round(subtotal * discountRate);
      const materials = state.materials ? MAT_RATE * hours * days * WEEKS_IN_MONTH : 0;
      const total = subtotal - monthlyDiscount + materials;
      return {
        rate: natRateVal, hours, maids, visits: days * WEEKS_IN_MONTH,
        labour: subtotal, materials, subtotal: subtotal + materials,
        monthlyDiscount, total,
        serviceName: "Custom Monthly",
        custom: true, days,
      };
    }
    maids  = Number(pkg.maids)       || 1;
    hours  = Number(pkg.hoursPerDay) || 4;
    visits = (Number(pkg.daysPerWeek) || 4) * WEEKS_IN_MONTH;
    const pkgPrice = natPrice(pkg, pkg?.priceMonthly);
    const materials = state.materials ? MAT_RATE * hours * visits : 0;
    return {
      rate: visits > 0 ? Math.round(pkgPrice / (hours * maids * visits)) : natRateVal,
      hours, maids, visits,
      labour: pkgPrice, materials, subtotal: pkgPrice + materials,
      monthlyDiscount: 0,
      total: pkgPrice + materials,
      serviceName: pkg.name,
      matRate: MAT_RATE,
    };
  }

  // Fixed-price service (e.g. sofa cleaning, car detailing)
  if (type?.fixedPrice != null && type.fixedPrice !== '') {
    const fixedAmt = Number(type.fixedPrice);
    return {
      rate: 0, hours: 0, maids: 1, visits: 1,
      labour: fixedAmt, materials: 0, subtotal: fixedAmt,
      monthlyDiscount: 0,
      total: fixedAmt,
      serviceName: type.name,
      isFixed: true,
      fixedPrice: fixedAmt,
    };
  }

  // Hourly
  const labour = svcRate * hours * maids;
  const materials = state.materials ? MAT_RATE * hours : 0;
  const subtotal = labour + materials;
  return {
    rate: svcRate, hours, maids, visits: 1,
    labour, materials, subtotal,
    monthlyDiscount: 0,
    total: subtotal,
    serviceName: type ? type.name : "Cleaning",
    matRate: MAT_RATE,
  };
}

const Money = ({ value, className = "" }) => (
  <span className={`font-mono tabular-nums ${className}`}>
    <span className="text-ink-500 mr-1 text-[0.78em] font-medium">QAR</span>{value.toLocaleString()}
  </span>
);

const Row = ({ label, value, sub, dim }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5">
    <div className={`text-[13px] ${dim ? "text-ink-500" : "text-ink-700"}`}>{label}{sub && <span className="text-ink-400 ml-1">· {sub}</span>}</div>
    <div className={`text-[13px] ${dim ? "text-ink-500" : "text-ink-800"}`}>{value}</div>
  </div>
);

const PriceCard = ({ state, breakdown, step, onPrimary, primaryLabel, primaryDisabled, compact }) => {
  const { rate, hours, maids, visits, labour, materials, subtotal, monthlyDiscount, total, serviceName, matRate, isFixed } = breakdown;
  return (
    <aside className={`bg-white rounded-xl2 hairline shadow-card overflow-hidden ${compact ? "" : ""}`}>
      <div className="px-5 pt-5 pb-3 border-b border-ink-200/70">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-ink-500">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-mint-500"></span>
          {isFixed ? 'Fixed price' : 'Live estimate'}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="text-[40px] leading-none font-bold text-ink-900 tracking-tight">
            <Money value={total} />
          </div>
        </div>
        <div className="mt-1 text-[12px] text-ink-500">
          {isFixed
            ? 'Flat-rate service · all-in'
            : state.mode === "monthly"
              ? `${visits} visits / month · all-in`
              : `${hours} hr${hours > 1 ? "s" : ""} · ${maids} maid${maids > 1 ? "s" : ""} · all-in`}
        </div>
      </div>

      <div className="px-5 py-4">
        {isFixed
          ? <Row label={serviceName} sub="Fixed price" value={<Money value={total} className="text-ink-700" />} />
          : <>
              <Row label={serviceName} sub={`${rate} QAR/hr`} value={<span className="font-mono tabular-nums text-ink-700">×{hours * maids * visits}h</span>} />
              <Row label="Labour" value={<Money value={labour} className="text-ink-800" />} />
              {state.materials && <Row label="Cleaning materials" sub={`${matRate ?? MATERIALS_PER_HOUR} QAR/hr`} value={<Money value={materials} />} />}
            </>
        }
        {monthlyDiscount > 0 && <Row label="Monthly plan discount" value={<span className="font-mono tabular-nums text-mint-700">−<Money value={monthlyDiscount} /></span>} />}
        <div className="my-3 border-t border-dashed border-ink-200"></div>
        <div className="flex items-baseline justify-between">
          <div className="text-[13px] text-ink-600">Subtotal</div>
          <Money value={total} className="text-ink-900 font-semibold text-[16px]" />
        </div>
      </div>

      <div className="px-5 pb-5">
        {onPrimary && (
          <PrimaryButton onClick={onPrimary} disabled={primaryDisabled} className="w-full">
            {primaryLabel}
            <Icon name="arrow-right" className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </PrimaryButton>
        )}
        <div className="mt-3 flex items-center gap-2 text-[11.5px] text-ink-500">
          <Icon name="shield" className="w-3.5 h-3.5 text-mint-700" />
          Vetted maids · Insured · Cancel free up to 6 hrs prior
        </div>
      </div>
    </aside>
  );
};

export { SERVICE_TYPES, MONTHLY_PACKAGES, STAYIN_PACKAGES, NATIONALITIES, MATERIALS_PER_HOUR, natRate, computePrice, PriceCard, Money };

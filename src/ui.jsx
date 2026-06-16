import React from 'react'

const Icon = ({ name, className = "w-5 h-5", strokeWidth = 1.6 }) => {
  const common = { fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", className };
  switch (name) {
    case "check":
      return <svg {...common}><path d="M4 12.5l5 5L20 6.5"/></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case "minus":
      return <svg {...common}><path d="M5 12h14"/></svg>;
    case "arrow-right":
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "arrow-left":
      return <svg {...common}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>;
    case "spark":
      return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M18.5 5.5l-2.8 2.8M8.3 15.7l-2.8 2.8"/></svg>;
    case "broom":
      return <svg {...common}><path d="M14 4l6 6"/><path d="M11 7l6 6-7 7H4v-6l7-7z"/><path d="M5 14l5 5"/></svg>;
    case "home":
      return <svg {...common}><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>;
    case "tools":
      return <svg {...common}><path d="M14.7 6.3a4 4 0 015.66 5.66l-1.42 1.42a1 1 0 01-1.41 0l-4.24-4.24a1 1 0 010-1.41L14.7 6.3z"/><path d="M11.4 9.6L4 17v3h3l7.4-7.4"/></svg>;
    case "hammer":
      return <svg {...common}><path d="M14 6l4 4-9 9-4-4 9-9z"/><path d="M14 6l3-3 4 4-3 3"/></svg>;
    case "calendar":
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "sun":
      return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>;
    case "moon":
      return <svg {...common}><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>;
    case "pin":
      return <svg {...common}><path d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>;
    case "user":
      return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>;
    case "phone":
      return <svg {...common}><path d="M5 4h3l2 5-2 1a12 12 0 006 6l1-2 5 2v3a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2z"/></svg>;
    case "card":
      return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>;
    case "x":
      return <svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case "sparkle-fill":
      return <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M12 2l1.8 5.6L19.5 9 13.8 10.5 12 16l-1.8-5.5L4.5 9l5.7-1.4L12 2z"/></svg>;
    default:
      return null;
  }
};

const Counter = ({ value, onChange, min = 1, max = 99, suffix }) => {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="inline-flex items-center gap-0 rounded-xl bg-white hairline overflow-hidden">
      <button type="button" onClick={dec} disabled={value <= min}
        className="w-10 h-10 grid place-items-center text-ink-700 hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed">
        <Icon name="minus" className="w-4 h-4" />
      </button>
      <div className="min-w-[3.25rem] text-center font-mono text-[15px] font-medium tabular-nums">
        {value}{suffix ? <span className="text-ink-500 ml-0.5">{suffix}</span> : null}
      </div>
      <button type="button" onClick={inc} disabled={value >= max}
        className="w-10 h-10 grid place-items-center text-ink-700 hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed">
        <Icon name="plus" className="w-4 h-4" />
      </button>
    </div>
  );
};

const BigCounter = ({ label, value, onChange, min = 1, max = 99, suffix }) => {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="rounded-xl bg-white hairline p-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3">
      <div className="text-[10px] sm:text-[12px] font-bold uppercase tracking-[0.1em] text-ink-500 text-center sm:text-left min-w-0">{label}</div>
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-shrink-0">
        <button onClick={dec} disabled={value <= min}
          className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg hairline bg-white text-ink-700 grid place-items-center hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <Icon name="minus" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <div className="w-11 sm:w-14 text-center font-mono text-[16px] sm:text-[18px] font-bold text-ink-900 tabular-nums">
          {value}<span className="text-[10px] sm:text-[11px] text-ink-400 ml-0.5">{suffix}</span>
        </div>
        <button onClick={inc} disabled={value >= max}
          className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg hairline bg-white text-ink-700 grid place-items-center hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <Icon name="plus" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
};

const Pill = ({ children, tone = "ink" }) => {
  const tones = {
    ink:     "bg-ink-100 text-ink-700",
    mint:    "bg-mint-100 text-mint-800",
    outline: "hairline text-ink-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-full text-[11px] font-medium tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
};

const PrimaryButton = ({ children, onClick, disabled, type = "button", className = "" }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`group inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-mint-500 text-ink-900 text-[14px] font-semibold shadow-mint hover:bg-mint-400 active:bg-mint-600 disabled:bg-ink-200 disabled:text-ink-500 disabled:shadow-none disabled:cursor-not-allowed transition-all ${className}`}
  >
    {children}
  </button>
);

const GhostButton = ({ children, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-[14px] text-ink-700 hover:bg-ink-100 transition-colors ${className}`}
  >
    {children}
  </button>
);

const SectionLabel = ({ title, subtitle }) => (
  <div className="mb-3 sm:mb-4">
    <h2 className="text-[17px] sm:text-[20px] font-bold text-ink-900 tracking-tight">{title}</h2>
    {subtitle && <p className="text-[12px] sm:text-[13px] text-ink-500 mt-0.5 sm:mt-1">{subtitle}</p>}
  </div>
);

const Field = ({ label, hint, error, children, optional, className = "" }) => (
  <label className={`block ${className}`}>
    <div className="flex items-baseline justify-between mb-1.5">
      <span className="text-[13px] font-semibold text-ink-700">{label}{optional && <span className="text-ink-400 font-normal ml-1">(optional)</span>}</span>
      {hint && <span className="text-[12px] text-ink-400">{hint}</span>}
    </div>
    {children}
    {error && <div className="mt-1 text-[12px] text-red-600">{error}</div>}
  </label>
);

const TextInput = React.forwardRef(({ icon, ...props }, ref) => (
  <div className="relative">
    {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"><Icon name={icon} className="w-4 h-4" /></span>}
    <input
      ref={ref}
      {...props}
      className={`w-full h-11 ${icon ? 'pl-10' : 'pl-4'} pr-4 rounded-xl bg-white hairline text-[14px] text-ink-900 placeholder:text-ink-400 focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)] outline-none transition-shadow`}
    />
  </div>
));

export { Icon, Counter, BigCounter, Pill, PrimaryButton, GhostButton, SectionLabel, Field, TextInput };

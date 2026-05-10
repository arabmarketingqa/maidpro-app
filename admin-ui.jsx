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

Object.assign(window, { AdminIcon, Switch, Card, PrimaryBtn, GhostBtn, IconBtn, TextField, Label, Pill, StatusPill });

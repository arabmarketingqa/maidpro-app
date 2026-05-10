/* Admin app — sidebar shell, routing, seed data (root) */

const NAV = [
  { id: "overview",     label: "Overview",     icon: "grid" },
  { id: "bookings",     label: "Bookings",     icon: "list" },
  { id: "services",     label: "Services",     icon: "broom" },
  { id: "nationalities",label: "Nationalities",icon: "globe" },
  { id: "packages",     label: "Packages",     icon: "package" },
  { id: "materials",    label: "Materials",    icon: "spray" },
  { id: "settings",     label: "Settings",     icon: "settings" },
];

const SEED_BOOKINGS = [
  { ref: "MP-2034", customer: "Aisha Al-Mansouri", phone: "+974 3344 1209", service: "Deep Cleaning",      mode: "Hourly",   date: "May 11", time: "09:00", maids: 2, hours: 5, total: 380, status: "Confirmed" },
  { ref: "MP-2033", customer: "Rohan Mehta",       phone: "+974 5567 8821", service: "Standard Package",   mode: "Monthly",  date: "May 10", time: "08:00", maids: 1, hours: 4, total: 1200, status: "In Progress" },
  { ref: "MP-2032", customer: "Sara Al-Thani",     phone: "+974 7712 5503", service: "Move-in / Out",      mode: "Hourly",   date: "May 12", time: "13:00", maids: 3, hours: 6, total: 720, status: "Pending" },
  { ref: "MP-2031", customer: "Daniel Okafor",     phone: "+974 6088 4412", service: "3-Month Stay-In",    mode: "Stay-In",  date: "May 09", time: "—",     maids: 1, hours: 24, total: 15000, status: "Confirmed" },
  { ref: "MP-2030", customer: "Priya Sharma",      phone: "+974 3001 7745", service: "Regular Cleaning",   mode: "Hourly",   date: "May 09", time: "10:00", maids: 1, hours: 4, total: 160, status: "Completed" },
  { ref: "MP-2029", customer: "Mohammad Al-Kuwari", phone: "+974 5544 9012", service: "Premium Package",   mode: "Monthly",  date: "May 08", time: "07:00", maids: 2, hours: 4, total: 2400, status: "Confirmed" },
  { ref: "MP-2028", customer: "Lisa Tan",          phone: "+974 7090 3344", service: "Post-Construction", mode: "Hourly",   date: "May 08", time: "14:00", maids: 4, hours: 8, total: 1280, status: "Cancelled" },
  { ref: "MP-2027", customer: "Faisal Ibrahim",    phone: "+974 6612 0099", service: "Custom Monthly",    mode: "Monthly",  date: "May 07", time: "16:00", maids: 1, hours: 4, total: 1080, status: "Completed" },
  { ref: "MP-2026", customer: "Hannah Reyes",      phone: "+974 3398 1126", service: "Regular Cleaning",  mode: "Hourly",   date: "May 07", time: "11:00", maids: 1, hours: 3, total: 120, status: "Completed" },
  { ref: "MP-2025", customer: "Ahmed Saif",        phone: "+974 7740 8855", service: "Deep Cleaning",     mode: "Hourly",   date: "May 06", time: "09:00", maids: 2, hours: 6, total: 480, status: "Pending" },
  { ref: "MP-2024", customer: "Veronica Cruz",     phone: "+974 5081 2233", service: "Basic Package",     mode: "Monthly",  date: "May 06", time: "08:00", maids: 1, hours: 4, total: 960, status: "Confirmed" },
  { ref: "MP-2023", customer: "Jaspreet Kaur",     phone: "+974 3320 4477", service: "12-Month Stay-In",  mode: "Stay-In",  date: "May 05", time: "—",     maids: 1, hours: 24, total: 54000, status: "Confirmed" },
];

const KPIS = [
  { label: "Bookings Today",    value: "47",     unit: "jobs",     delta: 12,  icon: "calendar", tone: "mint" },
  { label: "Active Maids",      value: "128",    unit: "live",     delta: 4,   icon: "users",    tone: "ink" },
  { label: "Revenue (MTD)",     value: "82,450", unit: "QAR",      delta: 18,  icon: "money",    tone: "mint" },
  { label: "Completion Rate",   value: "96.2",   unit: "%",        delta: -1,  icon: "trend",    tone: "ink" },
];

const initialStore = () => ({
  modes: [
    { id: "hourly",  name: "Hourly Booking",  emoji: "⏱️", desc: "On-demand cleaning, billed by the hour.",  bookings: 31, on: true },
    { id: "monthly", name: "Monthly Plans",   emoji: "📅", desc: "Recurring weekly cleaning packages.",       bookings: 12, on: true },
    { id: "stayin",  name: "Stay-In",         emoji: "🏠", desc: "Long-term live-in maid contracts.",         bookings: 4,  on: true },
  ],
  services: [
    { id: "regular", name: "Regular Cleaning",   emoji: "🧹", rate: 15, on: true },
    { id: "deep",    name: "Deep Cleaning",      emoji: "✨", rate: 18, on: true },
    { id: "movein",  name: "Move-in / Out",      emoji: "📦", rate: 20, on: true },
    { id: "post",    name: "Post-Construction", emoji: "🏗️", rate: 25, on: false },
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
    { id: "philippines", name: "Philippines", flag: "🇵🇭", rate: 40, on: true },
    { id: "indian",      name: "Indian",      flag: "🇮🇳", rate: 25, on: true },
    { id: "nepal",       name: "Nepal",       flag: "🇳🇵", rate: 20, on: true },
    { id: "nigeria",     name: "Nigeria",     flag: "🇳🇬", rate: 15, on: false },
  ],
  monthly: [
    { id: "basic",    name: "Basic Package",    emoji: "🌿", maids: 1, daysPerWeek: 4, hoursPerDay: 4, priceMonthly: 960,  discountLabel: "" },
    { id: "standard", name: "Standard Package", emoji: "⭐", maids: 1, daysPerWeek: 5, hoursPerDay: 4, priceMonthly: 1200, discountLabel: "MOST POPULAR" },
    { id: "premium",  name: "Premium Package",  emoji: "👑", maids: 2, daysPerWeek: 5, hoursPerDay: 4, priceMonthly: 2400, discountLabel: "" },
  ],
  stayIn: [
    { id: "si1",  name: "1 Month",   months: 1,  price: 5500,  save: 0,     notes: "Includes accommodation & food allowance." },
    { id: "si3",  name: "3 Months",  months: 3,  price: 15000, save: 1500,  notes: "Best for short contracts. Save 1,500 QAR." },
    { id: "si6",  name: "6 Months",  months: 6,  price: 28500, save: 4500,  notes: "Visa processing included." },
    { id: "si12", name: "12 Months", months: 12, price: 54000, save: 12000, notes: "Full annual contract — visa, insurance, end-of-service benefits." },
  ],
  materialsEnabled: true,
  materialsRate: 10,
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
});

/* ─── Sidebar ─── */
const Sidebar = ({ active, onNav, onClose, mobile }) => (
  <aside className={`sidebar-bg flex flex-col text-ink-200 ${mobile ? "h-full w-72" : "w-64 sticky top-0 h-dvh"} `}>
    <div className="px-5 pt-5 pb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-mint-500 grid place-items-center shadow-mint">
          <AdminIcon name="sparkle" className="w-5 h-5 text-ink-900" strokeWidth={2.4}/>
        </div>
        <div>
          <div className="text-[14.5px] font-extrabold text-white tracking-tight">Maid Pro</div>
          <div className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-ink-400">Admin · v2.4</div>
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

/* ─── Top bar ─── */
const TopBar = ({ section, onMenu, store }) => {
  const titles = {
    overview: "Overview",
    bookings: "Bookings",
    services: "Services & Operations",
    nationalities: "Nationality Manager",
    packages: "Packages",
    materials: "Materials & Add-ons",
    settings: "Settings",
  };
  const subtitles = {
    overview: "Snapshot of today's operations.",
    bookings: "Manage every job across hourly, monthly and stay-in.",
    services: "Configure service modes, types and operational limits.",
    nationalities: "Edit maid nationality options and rates.",
    packages: "Build monthly plans and stay-in contracts.",
    materials: "Cleaning materials add-on and supplied items.",
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
          <TextField icon="search" value="" onChange={() => {}} placeholder="Search bookings, customers…"/>
        </div>

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

/* ─── Settings (lightweight) ─── */
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

/* ─── Root App ─── */
const App = () => {
  const [section, setSection] = React.useState("overview");
  const [store, setStore] = React.useState(initialStore());
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const set = (patch) => setStore(prev => ({ ...prev, ...patch }));

  const sections = {
    overview:      <OverviewSection store={store} kpis={KPIS} bookings={SEED_BOOKINGS}/>,
    bookings:      <BookingsSection bookings={SEED_BOOKINGS}/>,
    services:      <ServicesSection store={store} set={set}/>,
    nationalities: <NationalitiesSection store={store} set={set}/>,
    packages:      <PackagesSection store={store} set={set}/>,
    materials:     <MaterialsSection store={store} set={set}/>,
    settings:      <SettingsSection store={store} set={set}/>,
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
        <TopBar section={section} onMenu={() => setDrawerOpen(true)} store={store}/>
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

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

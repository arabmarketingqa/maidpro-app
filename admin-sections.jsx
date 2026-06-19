/* Admin sections: Services, Nationalities, Packages, Materials, Operations, Bookings */

/* ─────── Services & Operations ─────── */
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
      <Card title="Service Configurator" subtitle="Manage names, icons and pricing for each service. Choose hourly (rate × hours × maids) or fixed flat price."
        action={<GhostBtn size="sm" tone="mint"><AdminIcon name="plus" className="w-4 h-4"/>Add service</GhostBtn>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {store.services.map(s => {
            const isFixed = s.fixedPrice != null && s.fixedPrice !== '';
            return (
              <div key={s.id} className="rounded-xl hairline bg-white p-4">
                <div className="flex items-start gap-3">
                  <input
                    value={s.emoji}
                    onChange={e => updateService(s.id, { emoji: e.target.value })}
                    className="w-12 h-12 text-center text-[26px] rounded-lg hairline bg-ink-50 outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <TextField value={s.name} onChange={v => updateService(s.id, { name: v })} placeholder="Service name" />

                    {/* Pricing type toggle */}
                    <div className="flex rounded-lg hairline overflow-hidden bg-ink-50 p-0.5 gap-0.5">
                      <button
                        onClick={() => updateService(s.id, { fixedPrice: null })}
                        className={`flex-1 h-7 rounded-md text-[11.5px] font-semibold transition-colors ${!isFixed ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}>
                        Hourly
                      </button>
                      <button
                        onClick={() => updateService(s.id, { fixedPrice: isFixed ? s.fixedPrice : (s.rate || 100) })}
                        className={`flex-1 h-7 rounded-md text-[11.5px] font-semibold transition-colors ${isFixed ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}>
                        Fixed price
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {isFixed
                        ? <TextField type="number" value={s.fixedPrice} onChange={v => updateService(s.id, { fixedPrice: v })} suffix="QAR flat" />
                        : <TextField type="number" value={s.rate} onChange={v => updateService(s.id, { rate: v })} suffix="QAR/hr" />
                      }
                      <div className="flex items-center justify-between rounded-lg hairline bg-ink-50 px-3">
                        <span className="text-[12px] text-ink-600 font-medium">Active</span>
                        <Switch on={s.on} onChange={v => updateService(s.id, { on: v })} ariaLabel={`Toggle ${s.name}`} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-mono text-ink-500">id: {s.id}</span>
                    {isFixed && <span className="text-[10.5px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">Fixed</span>}
                  </div>
                  <div className="flex">
                    <IconBtn icon="edit" />
                    <IconBtn icon="trash" tone="danger" />
                  </div>
                </div>
              </div>
            );
          })}
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
  const update = (id, patch) => set({ nationalities: store.nationalities.map(n => n.id === id ? { ...n, ...patch } : n) });
  const remove = (id) => set({ nationalities: store.nationalities.filter(n => n.id !== id) });
  const add = () => set({
    nationalities: [
      ...store.nationalities,
      { id: `new${Date.now()}`, name: "New nationality", flag: "🌍", rate: 20, on: true }
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
          <div className="hidden md:grid grid-cols-[64px_1.6fr_1.2fr_1fr_120px_64px] gap-3 px-6 py-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-500 border-b border-ink-200/70 bg-ink-50/50">
            <div>Flag</div>
            <div>Name</div>
            <div>Identifier</div>
            <div>Base Rate</div>
            <div>Active</div>
            <div></div>
          </div>
          <ul>
            {store.nationalities.map((n, i) => (
              <li key={n.id} className={`row-hover px-4 sm:px-6 py-3 ${i ? "border-t border-ink-200/70" : ""}`}>
                <div className="grid grid-cols-[48px_1fr] md:grid-cols-[64px_1.6fr_1.2fr_1fr_120px_64px] gap-3 items-center">
                  <input
                    value={n.flag}
                    onChange={e => update(n.id, { flag: e.target.value })}
                    className="w-12 h-12 text-center text-[26px] rounded-lg hairline bg-white outline-none focus:shadow-[inset_0_0_0_2px_oklch(0.72_0.13_168)]"
                  />
                  <div className="md:contents space-y-2 md:space-y-0">
                    <TextField value={n.name} onChange={v => update(n.id, { name: v })} placeholder="Country name" />
                    <TextField value={n.id} onChange={v => update(n.id, { id: v })} placeholder="id" inputClassName="font-mono text-[12.5px]" />
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

/* ─────── Materials & Add-ons ─────── */
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

/* ─────── Bookings table ─────── */
const BookingsSection = ({ bookings }) => {
  const [filter, setFilter] = React.useState("All");
  const [query, setQuery] = React.useState("");

  const filtered = bookings.filter(b =>
    (filter === "All" || b.status === filter) &&
    (!query || b.customer.toLowerCase().includes(query.toLowerCase()) || b.ref.toLowerCase().includes(query.toLowerCase()))
  );

  const filters = ["All", "Confirmed", "Pending", "In Progress", "Completed", "Cancelled"];

  return (
    <Card
      title={`Bookings · ${filtered.length}`}
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
          <TextField icon="search" value={query} onChange={setQuery} placeholder="Search ref or customer…"/>
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
                <td className="px-3 py-3.5 text-[13px] font-mono tabular-nums text-ink-700">{b.maids} × {b.hours}h</td>
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
  );
};

/* ─────── Overview KPI tiles ─────── */
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
                  {m.on ? "● ACCEPTING" : "○ PAUSED"}
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

Object.assign(window, { ServicesSection, NationalitiesSection, PackagesSection, MaterialsSection, BookingsSection, OverviewSection });

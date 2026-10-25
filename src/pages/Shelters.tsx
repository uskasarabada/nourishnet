import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeCheck, Calculator, Clock, Mail, Phone, Refrigerator, Scale, ShieldCheck, Truck } from 'lucide-react';
import { useStore } from '../state/store';
import { AXIS, Card, CardTitle, ChartTooltip, Details, GRID, Legend, PageHeader, Progress, ProvenanceBadge, Slider, URGENCY_STYLE, UrgencyBadge, cx, fmt } from '../components/ui';
import { FEATURE_BY_ID } from '../components/features';
import { STALE_AFTER_DAYS, STALE_DISCOUNT, URGENCY_WEIGHTS, urgency, type UrgencyLevel, type UrgencyResult } from '../lib/urgency';
import { forecastShelterNeed } from '../lib/needForecast';
import { CATEGORY_BY_ID } from '../lib/categories';
import type { FoodCategory, Shelter } from '../lib/types';
import { addDays, relativeDays, todayISO } from '../lib/dates';

const F = FEATURE_BY_ID.shelters;
const MAX_DAYS = 21; // inventory factor bottoms out at 3 weeks of food
const HAVE = '#2a78d6'; // on the shelves
const NEED = '#e0663f'; // still requested

export function Shelters() {
  const { shelters, dispatch } = useStore();
  const [params, setParams] = useSearchParams();
  const scored = useMemo(() => shelters.map((s) => ({ s, u: urgency(s) })).sort((a, b) => b.u.score - a.u.score), [shelters]);
  const focusId = params.get('focus') ?? scored[0]?.s.id;
  const focus = scored.find((x) => x.s.id === focusId) ?? scored[0];
  const select = (id: string) => setParams({ focus: id }, { replace: true });

  return (
    <div>
      <PageHeader
        eyebrow="Shelter needs"
        accent={F.color}
        light={F.light}
        icon={F.icon}
        title="Who needs food, and why"
        subtitle="Our three partner shelters and what they need most. Click one to see more."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {scored.map(({ s, u }) => (
          <ShelterCard key={s.id} s={s} u={u} selected={s.id === focus?.s.id} onSelect={() => select(s.id)} />
        ))}
      </div>

      {focus && <ShelterDetail s={focus.s} u={focus.u} onVerify={() => dispatch({ type: 'verifyShelter', shelterId: focus.s.id })} />}

      <UrgencyDeepDive shelters={scored} />
    </div>
  );
}

// ── Inventory gauge: days of food left ─────────────────────────────────────
function DaysGauge({ days, size = 96 }: { days: number; size?: number }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, days / MAX_DAYS);
  const color = days <= 5 ? '#C24E2A' : days <= 10 ? '#B57F05' : '#1f8a52';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${days} days of food on hand`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDE7DA" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-2xl font-semibold leading-none tabular" style={{ color }}>{days}</div>
          <div className="text-[10px] font-semibold uppercase text-ink-500">days left</div>
        </div>
      </div>
    </div>
  );
}

function ShelterCard({ s, u, selected, onSelect }: { s: Shelter; u: UrgencyResult; selected: boolean; onSelect: () => void }) {
  const open = s.needs.filter((n) => n.quantityReceived < n.quantityNeeded);
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cx('card flex flex-col p-5 text-left transition-all hover:shadow-lift', selected && 'ring-2')}
      style={selected ? { ['--tw-ring-color' as string]: F.color } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-xl font-semibold text-forest-900">{s.name}</div>
          <div className="text-sm text-ink-500">{s.kind} · {s.neighborhood}</div>
        </div>
        <UrgencyBadge level={u.level} score={u.score} />
      </div>
      <div className="mt-4 flex items-center gap-5">
        <DaysGauge days={s.inventoryDaysOnHand} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-400">They need</div>
          <ul className="mt-1 space-y-1 text-sm text-ink-700">
            {open.slice(0, 3).map((n) => (
              <li key={n.label} className="flex justify-between gap-2">
                <span className="truncate">{n.label}</span>
                <span className="shrink-0 font-semibold tabular">{fmt(n.quantityNeeded - n.quantityReceived)} {n.unit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  );
}

function FactorBars({ u }: { u: UrgencyResult }) {
  return (
    <div className="space-y-2.5">
      {u.factors.map((x) => (
        <div key={x.key} className="text-xs">
          <div className="flex justify-between">
            <span className="font-semibold text-ink-700">{x.label} <span className="font-normal text-ink-400">(up to {Math.round(URGENCY_WEIGHTS[x.key] * 100)} pts)</span></span>
            <span className="tabular font-semibold text-ink-900">+{x.contribution.toFixed(0)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-cream-300">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${x.value * 100}%`, background: F.color }} />
          </div>
          <div className="mt-0.5 text-ink-500">{x.explanation}</div>
        </div>
      ))}
    </div>
  );
}

function ShelterDetail({ s, u, onVerify }: { s: Shelter; u: UrgencyResult; onVerify: () => void }) {
  const f = forecastShelterNeed(s);
  const chart = f.weeks.slice(-12).map((w) => ({ ...w, band: w.demandLow !== undefined ? [w.demandLow, w.demandHigh] : undefined }));
  const stockVsNeed = useMemo(() => {
    const cats = new Set<FoodCategory>([...(Object.keys(s.stockByCategory ?? {}) as FoodCategory[]), ...s.needs.map((n) => n.category)]);
    return [...cats]
      .map((c) => ({
        name: CATEGORY_BY_ID[c].short,
        have: s.stockByCategory?.[c] ?? 0,
        need: Math.round(s.needs.filter((n) => n.category === c).reduce((a, n) => a + Math.max(0, n.quantityNeeded - n.quantityReceived) * n.lbsPerUnit, 0)),
      }))
      .sort((a, b) => b.need - a.need || b.have - a.have);
  }, [s]);

  return (
    <div className="mt-6 space-y-6 animate-rise" key={s.id}>
      <Card className="card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-forest-900">{s.name}</h2>
            <div className="text-sm text-ink-500">{s.address} · {s.hours}</div>
          </div>
          <ProvenanceBadge kind={s.provenance} />
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="label">What they need</div>
            <table className="w-full text-sm">
              <tbody>
                {s.needs.map((n) => (
                  <tr key={n.label} className="border-t border-cream-200">
                    <td className="py-2"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: CATEGORY_BY_ID[n.category].color }} />{n.label}</td>
                    <td className="py-2 text-right font-semibold tabular">{fmt(Math.max(0, n.quantityNeeded - n.quantityReceived))} {n.unit}</td>
                    <td className="w-20 py-2 pl-3"><Progress value={n.quantityReceived} max={n.quantityNeeded} label={`${n.label} progress`} /></td>
                    <td className="py-2 pl-2 text-right text-xs text-ink-400">by {relativeDays(n.deadline).replace('in ', '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="label">How to donate</div>
            <p className="text-sm text-ink-700">{s.instructions}</p>
            <div className="mt-3 space-y-1 text-xs text-ink-500">
              {s.contact.public && s.contact.phone && <div className="flex items-center gap-2"><Phone size={13} /> {s.contact.phone}</div>}
              {s.contact.public && s.contact.email && <div className="flex items-center gap-2"><Mail size={13} /> {s.contact.email}</div>}
            </div>
            <Link to="/match" className="btn mt-4 text-white" style={{ background: FEATURE_BY_ID.match.color }}>Send food to shelters</Link>
          </div>
        </div>
      </Card>

      <Details>
        <Card className="card-pad">
          <CardTitle title={`Why ${s.name.split(' ')[0]} scores ${u.score}`} subtitle={u.stale ? `Includes a ×${STALE_DISCOUNT} discount: request not re-verified in ${u.daysSinceVerified} days` : 'Each bar shows how much of that factor applies'} icon={<Scale size={18} />} right={<UrgencyBadge level={u.level} score={u.score} />} />
          <FactorBars u={u} />
        </Card>
        <div className="grid gap-6 xl:grid-cols-2">
        <Card className="card-pad">
          <CardTitle title="Supply vs. demand" subtitle="Food handed out each week, the forecast for the next 6 weeks, and the projected inventory left on the shelves." />
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="week" {...AXIS} />
                <YAxis {...AXIS} tickFormatter={(v) => fmt(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Area dataKey="band" name="Demand range" fill="#FAD9CF" stroke="none" fillOpacity={0.7} isAnimationActive={false} />
                <Line dataKey="actual" name="Handed out" stroke="#3B4740" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="demand" name="Forecast demand" stroke="#C24E2A" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Line dataKey="inventory" name="Inventory left" stroke={HAVE} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
                <ReferenceLine x="Now" stroke="#A9B0AB" label={{ value: 'Now', position: 'top', fontSize: 10, fill: '#7D8781' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ label: 'Handed out', color: '#3B4740' }, { label: 'Forecast demand', color: '#C24E2A', dashed: true }, { label: 'Inventory left', color: HAVE }]} />
          <p className={cx('mt-2 text-xs font-semibold', f.shortageWeek ? 'text-amber-700' : 'text-forest-700')}>
            {f.shortageWeek ? `At this rate, shelves drop below half a week of food in week ${f.shortageWeek}.` : 'No shortage expected in the next 6 weeks at current supply.'}
          </p>
        </Card>

        <Card className="card-pad">
          <CardTitle title="Inventory vs. requests" subtitle="Pounds on the shelves compared with pounds still requested, by food type" />
          <div style={{ height: Math.max(180, stockVsNeed.length * 40) }}>
            <ResponsiveContainer>
              <BarChart data={stockVsNeed} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }} barCategoryGap={8} barGap={2}>
                <CartesianGrid {...GRID} horizontal={false} vertical />
                <XAxis type="number" {...AXIS} tickFormatter={(v) => fmt(v)} />
                <YAxis type="category" dataKey="name" width={80} {...AXIS} tick={{ fill: '#3B4740', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#F4EFE3' }} content={<ChartTooltip />} />
                <Bar dataKey="have" name="On the shelves" fill={HAVE} radius={[0, 4, 4, 0]} />
                <Bar dataKey="need" name="Still requested" fill={NEED} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ label: 'On the shelves', color: HAVE }, { label: 'Still requested', color: NEED }]} />
        </Card>
        </div>
        <Card className="card-pad">
          <CardTitle title="About this shelter" />
          <div className="grid gap-2 text-sm text-ink-700 sm:grid-cols-2">
            <div className="flex items-center gap-2"><BadgeCheck size={14} className={u.stale ? 'text-amber-600' : 'text-forest-500'} /> Info checked {relativeDays(s.lastVerified)} by {s.verifiedBy}</div>
            <div className="flex items-center gap-2"><Clock size={14} className="text-ink-400" /> {s.hours}</div>
            <div className="flex items-center gap-2"><Refrigerator size={14} className="text-ink-400" /> {s.storage.refrigerated ? 'Has a fridge' : 'No fridge (shelf-stable food only)'} · room for {fmt(s.storage.dryCapacityLbs)} lb</div>
            <div className="flex items-center gap-2"><Truck size={14} className="text-ink-400" /> Hands food out within ~{s.turnoverDays} days</div>
          </div>
          <button className="btn-secondary mt-4" onClick={onVerify}><BadgeCheck size={15} /> Staff: confirm this info is current</button>
        </Card>
      </Details>
    </div>
  );
}

// ── Urgency deep dive ──────────────────────────────────────────────────────

const FACTOR_DOCS: { key: keyof typeof URGENCY_WEIGHTS; title: string; measures: string; scale: string; why: string }[] = [
  {
    key: 'severity',
    title: 'Reported shortage',
    measures: 'How serious staff say the shortage is, on a 1–5 scale.',
    scale: '1 → 0 points, 5 → 35 points',
    why: 'Staff know things numbers miss (a broken freezer, a sudden rush of families), so their judgment gets the biggest single weight.',
  },
  {
    key: 'deadline',
    title: 'Deadline',
    measures: 'Days until the soonest open request is due.',
    scale: 'Due today → 25 points, 30+ days away → 0',
    why: "Food that arrives after a weekend meal program has run is far less useful. Time pressure matters.",
  },
  {
    key: 'unmet',
    title: 'Still needed',
    measures: 'Share of requested pounds not yet received.',
    scale: 'Nothing received → 20 points, fully filled → 0',
    why: 'Prevents piling more food on a request that other donors already covered.',
  },
  {
    key: 'inventory',
    title: 'Food on hand',
    measures: 'How many days current shelf stock would last.',
    scale: '0 days → 20 points, 21+ days → 0',
    why: 'An objective check: a shelter with three weeks of food is less urgent than one with three days, whatever else is reported.',
  },
];

/** Builds a shelter from slider values so the calculator runs the real urgency() function. */
function hypothetical(severity: number, deadlineDays: number, unmetPct: number, daysOnHand: number, daysSinceVerified: number): Shelter {
  const today = todayISO();
  return {
    id: 'calc', name: 'Calculator', kind: 'Shelter', location: { lat: 0, lng: 0 }, address: '', neighborhood: '',
    needs: [{ category: 'grains', label: 'Request', unit: 'lbs', lbsPerUnit: 1, quantityNeeded: 100, quantityReceived: 100 - unmetPct, deadline: addDays(today, deadlineDays) }],
    reportedSeverity: severity as Shelter['reportedSeverity'], inventoryDaysOnHand: daysOnHand, lastVerified: addDays(today, -daysSinceVerified),
    verifiedBy: '', instructions: '', hours: '', contact: { public: false }, storage: { refrigerated: false, frozen: false, dryCapacityLbs: 0 },
    turnoverDays: 1, peopleServedWeekly: 0, weeklyDistributionLbs: [0], weeklyBaselineSupplyLbs: 0, currentInventoryLbs: 0, provenance: 'sample',
  };
}

const LEVELS: [UrgencyLevel, number, string][] = [
  ['Low', 0, 'Below 35'],
  ['Moderate', 35, '35–54'],
  ['High', 55, '55–74'],
  ['Critical', 75, '75 and up'],
];

function UrgencyDeepDive({ shelters }: { shelters: { s: Shelter; u: UrgencyResult }[] }) {
  const [sev, setSev] = useState(4);
  const [deadline, setDeadline] = useState(5);
  const [unmet, setUnmet] = useState(80);
  const [onHand, setOnHand] = useState(5);
  const [verified, setVerified] = useState(2);
  const u = urgency(hypothetical(sev, deadline, unmet, onHand, verified));

  const load = (s: Shelter, r: UrgencyResult) => {
    setSev(s.reportedSeverity);
    setDeadline(Math.min(30, Math.max(0, r.nearestDeadlineDays)));
    setUnmet(Math.round((100 * r.unmetLbs) / Math.max(1, r.requestedLbs)));
    setOnHand(Math.min(MAX_DAYS, s.inventoryDaysOnHand));
    setVerified(Math.min(30, r.daysSinceVerified));
  };

  return (
    <section id="urgency" className="mt-14 scroll-mt-24">
      <h2 className="text-3xl font-semibold text-forest-900">How the urgency score works</h2>
      <p className="mt-2 max-w-2xl text-ink-500">Every shelter gets a score from 0 to 100. It adds up four things, and the higher the score, the sooner they need food.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {FACTOR_DOCS.map((d) => (
          <div key={d.key} className="rounded-2xl border p-5" style={{ borderColor: F.border, background: F.tint }}>
            <div className="font-display text-3xl font-semibold" style={{ color: F.color }}>up to {Math.round(URGENCY_WEIGHTS[d.key] * 100)}</div>
            <div className="mt-1 font-bold text-ink-900">{d.title}</div>
            <p className="mt-1 text-sm text-ink-700">{d.measures}</p>
          </div>
        ))}
      </div>

      <Details label="Learn more and try it yourself" hideLabel="Show less" className="mt-6" defaultOpen={useLocation().hash === '#urgency'}>
      <Card className="card-pad">
        <div className="rounded-2xl bg-cream-100 p-4 text-center font-mono text-sm leading-relaxed sm:text-base">
          urgency = 35 × <span style={{ color: F.color }}>severity</span> + 25 × <span style={{ color: F.color }}>deadline</span> + 20 × <span style={{ color: F.color }}>still&nbsp;needed</span> + 20 × <span style={{ color: F.color }}>low&nbsp;stock</span>
        </div>
        <p className="mt-2 text-center text-xs text-ink-500">Each factor is scaled from 0 (no concern) to 1 (maximum concern), so the score always runs 0–100. Anyone can recompute it by hand.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FACTOR_DOCS.map((d) => (
            <div key={d.key} className="text-sm">
              <div className="font-bold text-ink-900">{d.title}</div>
              <p className="mt-1 text-xs font-semibold text-ink-500">{d.scale}</p>
              <p className="mt-1 text-ink-500"><strong className="text-ink-700">Why: </strong>{d.why}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Interactive calculator */}
      <Card className="card-pad mt-6">
        <CardTitle title="Try it yourself" subtitle="Move the sliders, or load one of our shelters. This runs the exact same code the app uses." icon={<Calculator size={18} />} />
        <div className="mb-5 flex flex-wrap gap-2">
          {shelters.map(({ s, u: r }) => (
            <button key={s.id} className="chip-off" onClick={() => load(s, r)}>Load {s.name}</button>
          ))}
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-5">
            <Slider label="Reported shortage (1–5)" value={sev} min={1} max={5} onChange={setSev} />
            <Slider label="Days until the request is due" value={deadline} min={0} max={30} onChange={setDeadline} format={(v) => (v === 0 ? 'today' : `${v} days`)} />
            <Slider label="Share still needed" value={unmet} min={0} max={100} step={5} onChange={setUnmet} format={(v) => `${v}%`} />
            <Slider label="Days of food on hand" value={onHand} min={0} max={MAX_DAYS} onChange={setOnHand} format={(v) => `${v} days`} />
            <Slider label="Days since staff verified" value={verified} min={0} max={30} onChange={setVerified} format={(v) => `${v} days`} hint={`After ${STALE_AFTER_DAYS} days the whole score is multiplied by ${STALE_DISCOUNT} until staff re-confirm.`} />
          </div>
          <div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Urgency score</div>
                <div className="font-display text-6xl font-semibold tabular" style={{ color: URGENCY_STYLE[u.level].dot }}>{u.score}</div>
              </div>
              <UrgencyBadge level={u.level} stale={u.stale} />
            </div>
            {/* Stacked contribution bar with level thresholds */}
            <div className="relative mt-4">
              <div className="flex h-6 overflow-hidden rounded-full bg-cream-200">
                {u.factors.map((x, i) => (
                  <div key={x.key} title={`${x.label}: +${x.contribution.toFixed(0)}`} className="h-full border-r-2 border-white transition-all duration-300 last:border-r-0" style={{ width: `${x.contribution * (u.stale ? STALE_DISCOUNT : 1)}%`, background: F.color, opacity: 1 - i * 0.2 }} />
                ))}
              </div>
              {LEVELS.slice(1).map(([l, t]) => (
                <div key={l} className="absolute top-0 h-6 border-l-2 border-dashed border-ink-400" style={{ left: `${t}%` }}>
                  <span className="absolute left-1 top-7 whitespace-nowrap text-[10px] font-semibold text-ink-500">{l} {t}</span>
                </div>
              ))}
            </div>
            <div className="mt-10"><FactorBars u={u} /></div>
          </div>
        </div>
      </Card>

      {/* Worked comparison */}
      <Card className="card-pad mt-6">
        <CardTitle title="Worked example: our three partners" subtitle="Same formula, different situations" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-400">
                <th className="pb-2 font-semibold">Shelter</th>
                {FACTOR_DOCS.map((d) => <th key={d.key} className="pb-2 text-right font-semibold">{d.title}</th>)}
                <th className="pb-2 text-right font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {shelters.map(({ s, u: r }) => (
                <tr key={s.id} className="border-t border-cream-200 align-top">
                  <td className="py-3">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-ink-500">{r.factors.slice().sort((a, b) => b.contribution - a.contribution)[0].explanation}</div>
                  </td>
                  {r.factors.map((x) => <td key={x.key} className="py-3 text-right tabular">+{x.contribution.toFixed(0)}</td>)}
                  <td className="py-3 text-right"><span className="font-display text-xl font-semibold tabular" style={{ color: URGENCY_STYLE[r.level].dot }}>{r.score}</span><div><UrgencyBadge level={r.level} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="card-pad">
          <CardTitle title="Levels" />
          <div className="space-y-2">
            {LEVELS.slice().reverse().map(([l, , r]) => (
              <div key={l} className={cx('flex items-center justify-between rounded-xl border px-3 py-2', URGENCY_STYLE[l].bg)}>
                <UrgencyBadge level={l} />
                <span className="text-xs text-ink-500">Score {r}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="card-pad">
          <CardTitle title="Built-in safeguards" icon={<ShieldCheck size={18} />} />
          <ul className="space-y-2 text-sm text-ink-700">
            <li><strong>Can't be gamed by one number.</strong> Severity alone adds at most 35 points. Reaching Critical (75) also needs a real deadline, unmet requests, or low stock.</li>
            <li><strong>Old information fades.</strong> Requests not re-verified in {STALE_AFTER_DAYS} days are flagged and multiplied by {STALE_DISCOUNT}.</li>
            <li><strong>Every source is shown.</strong> Each profile lists who verified it, how, and when.</li>
          </ul>
        </Card>
        <Card className="card-pad">
          <CardTitle title="Honest limits" />
          <ul className="space-y-2 text-sm text-ink-700">
            <li>The weights are our team's starting point. With real partners, we'd review them together.</li>
            <li>Days-on-hand and severity are reported by staff, so the score is only as good as those reports. That's why verification dates matter.</li>
            <li>Urgency decides <em>priority</em>, not who deserves food. Matching still spreads food across every partner.</li>
          </ul>
        </Card>
      </div>
      </Details>
    </section>
  );
}

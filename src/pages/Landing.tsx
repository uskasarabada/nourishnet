import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, MapPinned } from 'lucide-react';
import { useStore } from '../state/store';
import { forecast } from '../lib/forecast';
import { LBS_PER_MEAL } from '../lib/categories';
import { needLbs } from '../lib/urgency';
import { matchDonations, supplyFromLots, supplyFromTotals } from '../lib/matching';
import { Slider, fmt } from '../components/ui';
import { FEATURES } from '../components/features';

const SOURCES = [
  { name: 'Feeding America', url: 'https://www.feedingamerica.org/', use: '1.2 lb of food ≈ 1 meal', status: 'Used now' },
  { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/', use: 'The map', status: 'Used now' },
  { name: 'Map the Meal Gap', url: 'https://map.feedingamerica.org/', use: 'Hunger rates by county', status: 'Next step' },
  { name: 'USDA Food Access Atlas', url: 'https://www.ers.usda.gov/data-products/food-access-research-atlas/', use: 'Areas far from grocery stores', status: 'Next step' },
  { name: 'USDA FoodKeeper', url: 'https://www.foodsafety.gov/keep-food-safe/foodkeeper-app', use: 'How long food stays safe', status: 'Next step' },
];

export function Landing() {
  const { model, drives, shelters, backtest } = useStore();
  const [participants, setParticipants] = useState(400);
  const [days, setDays] = useState(5);
  const month = new Date().getMonth();
  const fc = useMemo(
    () => forecast(model, { orgType: 'school', participants, durationDays: days, month, categories: ['grains', 'protein', 'canned_veg', 'canned_fruit', 'breakfast'] }),
    [model, participants, days, month],
  );

  // Success metrics, computed live from the app's own data.
  const need = shelters.reduce((acc, s) => { const n = needLbs(s); return { requested: acc.requested + n.requested, unmet: acc.unmet + n.unmet }; }, { requested: 0, unmet: 0 });
  const needFilled = Math.round((100 * (need.requested - need.unmet)) / Math.max(1, need.requested));
  const active = drives.find((d) => d.status === 'active');
  const matched = useMemo(() => {
    if (!active) return null;
    const supply = active.inventory?.length ? supplyFromLots(active.inventory) : supplyFromTotals(active.collectedByCategory ?? {});
    const r = matchDonations(active.location, supply, shelters, { maxMiles: 15, locks: {}, excluded: [] });
    return Math.round((100 * r.totalAllocated) / Math.max(1, r.totalSupply));
  }, [active, shelters]);

  const metrics = [
    { value: `${Math.round(backtest.mape * 100)}%`, label: 'Average forecast error', note: `A simple rule of thumb is off by ${Math.round(backtest.baselineMape * 100)}%` },
    { value: `${Math.round(backtest.coverage80 * 100)}%`, label: 'Results inside our range', note: 'We aim for about 80%' },
    { value: `${needFilled}%`, label: 'Shelter requests filled', note: 'We aim for 100%' },
    { value: matched === null ? '—' : `${matched}%`, label: 'Food sent where it was asked for', note: 'For the drive running now' },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-forest-100/60 blur-3xl" />
        <div className="container-wide relative grid items-center gap-12 pb-16 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="animate-rise">
            <h1 className="text-[2.6rem] font-semibold leading-[1.05] text-forest-900 sm:text-6xl">
              Know what your food drive needs <em className="font-display italic text-forest-500">before</em> it starts.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-500">
              NourishNet predicts how much food your drive will collect, then helps you send it to the local shelters that need it most.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/plan" className="btn-primary px-5 py-3 text-[15px]">Plan a drive <ArrowRight size={16} /></Link>
              <Link to="/drives" className="btn-secondary px-5 py-3 text-[15px]"><MapPinned size={16} /> See local drives</Link>
            </div>
          </div>

          <div className="animate-rise [animation-delay:120ms]">
            <div className="card p-6 shadow-lift sm:p-7">
              <div className="font-display text-xl font-semibold text-forest-900">Try it: a school food drive</div>
              <div className="mt-5 space-y-5">
                <Slider label="People giving" value={participants} min={50} max={1200} step={10} onChange={setParticipants} />
                <Slider label="Days" value={days} min={1} max={14} onChange={setDays} format={(v) => `${v} day${v > 1 ? 's' : ''}`} />
              </div>
              <div className="mt-6 rounded-2xl bg-forest-50 p-5">
                <div className="text-sm text-ink-500">You'll likely collect about</div>
                <div className="font-display text-5xl font-semibold text-forest-800 tabular">{fmt(Math.round(fc.median / 10) * 10)} lb</div>
                <div className="mt-1 text-ink-700">≈ {fmt(fc.median / LBS_PER_MEAL)} meals</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-wide py-16">
        <h2 className="text-3xl font-semibold text-forest-900 sm:text-4xl">How it works</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Link key={f.id} to={f.to} className="group rounded-xl2 border bg-white p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift" style={{ borderColor: f.border }}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: f.color }}>{f.icon}</div>
                <span className="text-sm font-semibold" style={{ color: f.color }}>Step {i + 1}</span>
              </div>
              <div className="mt-4 text-xl font-bold text-ink-900">{f.title}</div>
              <p className="mt-1 text-ink-500">{f.short}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: f.color }}>
                Open <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Success metrics */}
      <section id="metrics" className="scroll-mt-24 bg-forest-900 text-white">
        <div className="container-wide py-16">
          <h2 className="text-3xl font-semibold sm:text-4xl">How we know it's working</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-2xl border border-forest-700 bg-forest-800/60 p-5">
                <div className="font-display text-5xl font-semibold tabular">{m.value}</div>
                <div className="mt-2 font-bold">{m.label}</div>
                <div className="text-sm text-forest-200">{m.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data sources */}
      <section id="sources" className="container-wide scroll-mt-24 py-16">
        <h2 className="text-2xl font-semibold text-forest-900">Where our data comes from</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {SOURCES.map((s) => (
            <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="card p-4 transition-shadow hover:shadow-lift">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-ink-900">{s.name}</span>
                <ExternalLink size={13} className="shrink-0 text-ink-400" />
              </div>
              <div className="mt-1 text-sm text-ink-500">{s.use}</div>
              <span className={s.status === 'Used now' ? 'mt-3 inline-block rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-bold text-forest-700' : 'mt-3 inline-block rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-bold text-ink-500'}>{s.status}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

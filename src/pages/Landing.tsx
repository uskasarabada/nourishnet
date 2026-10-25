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
import { HeroLines } from '../components/HeroLines';

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
      <section className="relative overflow-hidden bg-night-900 text-white">
        <HeroLines />
        <div className="container-wide relative flex min-h-[calc(100vh-5rem)] max-h-[860px] flex-col justify-center py-24">
          <h1 className="max-w-5xl animate-rise text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-7xl lg:text-[5.5rem]">
            Predict Every Food Drive. Feed More Families.
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/90 sm:text-2xl">
            Know how much food your drive will collect before it starts, then send every pound to the local shelters that need it most.
          </p>
          <div className="mt-12">
            <Link to="/plan" className="btn-primary px-12 py-5 text-lg font-semibold">
              Plan Your Food Drive <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Try it */}
      <section className="container-wide grid items-center gap-10 py-20 lg:grid-cols-2">
        <div>
          <h2 className="text-4xl font-semibold text-night-900 sm:text-5xl">Try it in five seconds.</h2>
          <p className="mt-4 max-w-lg text-lg text-ink-500">Move the sliders. Our model, trained on {model.rows.length} past drives, predicts what a school food drive would collect this month.</p>
          <Link to="/drives" className="btn-secondary mt-8 px-6 py-3 text-base"><MapPinned size={18} /> See local drives</Link>
        </div>
        <div className="card p-7">
          <div className="space-y-6">
            <Slider label="People giving" value={participants} min={50} max={1200} step={10} onChange={setParticipants} />
            <Slider label="Days" value={days} min={1} max={14} onChange={setDays} format={(v) => `${v} day${v > 1 ? 's' : ''}`} />
          </div>
          <div className="mt-7 rounded-[3px] bg-night-900 p-6 text-white">
            <div className="text-sm text-white/60">You'll likely collect about</div>
            <div className="font-display text-6xl font-semibold tracking-[-0.03em] text-lime-400 tabular">{fmt(Math.round(fc.median / 10) * 10)} lb</div>
            <div className="mt-1 text-white/80">≈ {fmt(fc.median / LBS_PER_MEAL)} meals</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-wide pb-20">
        <h2 className="text-4xl font-semibold text-night-900 sm:text-5xl">How it works</h2>
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
      <section id="metrics" className="relative scroll-mt-24 overflow-hidden bg-night-900 text-white">
        <HeroLines />
        <div className="container-wide relative py-20">
          <h2 className="text-4xl font-semibold sm:text-5xl">How we know it's working</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-[3px] border border-white/10 bg-white/[0.03] p-6">
                <div className="font-display text-6xl font-semibold tracking-[-0.03em] text-lime-400 tabular">{m.value}</div>
                <div className="mt-2 font-bold">{m.label}</div>
                <div className="text-sm text-white/60">{m.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data sources */}
      <section id="sources" className="container-wide scroll-mt-24 py-16">
        <h2 className="text-4xl font-semibold text-night-900">Where our data comes from</h2>
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

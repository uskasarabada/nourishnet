import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Building2, CalendarHeart, GitCompareArrows, HandHeart, MapPinned, School, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { useStore } from '../state/store';
import { forecast } from '../lib/forecast';
import { LBS_PER_MEAL } from '../lib/categories';
import { urgency } from '../lib/urgency';
import { ProvenanceBadge, Slider, UrgencyBadge, fmt, fmtK } from '../components/ui';
import { RangeBar } from '../components/forecastViews';

export function Landing() {
  const { model, drives, shelters, backtest } = useStore();
  const [participants, setParticipants] = useState(400);
  const [days, setDays] = useState(5);
  const month = new Date().getMonth();
  const fc = useMemo(
    () => forecast(model, { orgType: 'school', participants, durationDays: days, month, categories: ['grains', 'protein', 'canned_veg', 'canned_fruit', 'breakfast'] }),
    [model, participants, days, month],
  );

  const completed = drives.filter((d) => d.status === 'completed');
  const totalLbs = completed.reduce((a, d) => a + (d.collectedLbs ?? 0), 0);
  const topShelters = [...shelters].map((s) => ({ s, u: urgency(s) })).sort((a, b) => b.u.score - a.u.score).slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-forest-100/60 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-32 top-64 h-[380px] w-[380px] rounded-full bg-amber-100/50 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-white px-3 py-1 text-xs font-semibold text-forest-700">
              <Sparkles size={13} /> Forecasting for community food drives
            </span>
            <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.05] text-forest-900 sm:text-6xl">
              Know what your food drive needs <em className="font-display italic text-forest-500">before</em> it starts.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-500">
              NourishNet predicts how much food a drive will collect, plans the volunteers, boxes, and vehicles to handle it, and routes every
              pound to the verified shelter requests that need it most.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/predict" className="btn-primary px-5 py-3 text-[15px]">
                Forecast a drive <ArrowRight size={16} />
              </Link>
              <Link to="/map" className="btn-secondary px-5 py-3 text-[15px]">
                <MapPinned size={16} /> Explore the map
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {[
                { k: 'Typical forecast error', v: `${Math.round(backtest.mape * 100)}%`, s: `vs ${Math.round(backtest.baselineMape * 100)}% for a rule of thumb` },
                { k: 'Past drives mapped', v: completed.length, s: 'learning set' },
                { k: 'Pounds tracked', v: fmtK(totalLbs), s: `≈ ${fmtK(totalLbs / LBS_PER_MEAL)} meals` },
              ].map((x) => (
                <div key={x.k}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{x.k}</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-forest-900 tabular">{x.v}</dd>
                  <dd className="text-[11px] text-ink-400">{x.s}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3"><ProvenanceBadge kind="sample" /> <span className="text-[11px] text-ink-400">Figures computed from fictional demo history.</span></div>
          </div>

          {/* Interactive preview */}
          <div className="animate-rise [animation-delay:120ms]">
            <div className="card relative p-6 shadow-lift sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Live preview</div>
                  <div className="mt-1 font-display text-xl font-semibold text-forest-900">A school food drive this month</div>
                </div>
                <span className="rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-bold text-forest-700">80% range</span>
              </div>
              <div className="mt-6 space-y-5">
                <Slider label="Participants" value={participants} min={50} max={1200} step={10} onChange={setParticipants} />
                <Slider label="Event length" value={days} min={1} max={14} onChange={setDays} format={(v) => `${v} day${v > 1 ? 's' : ''}`} />
              </div>
              <div className="mt-6 rounded-2xl bg-cream-100 p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs font-semibold text-ink-500">Predicted collection</div>
                    <div className="font-display text-3xl font-semibold text-forest-900 tabular sm:text-4xl">
                      {fmt(fc.low)}–{fmt(fc.high)} <span className="text-lg text-ink-500">lb</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-ink-500">Meals</div>
                    <div className="font-display text-2xl font-semibold text-forest-700 tabular">≈{fmt(fc.median / LBS_PER_MEAL)}</div>
                  </div>
                </div>
                <RangeBar fc={fc} scaleMax={Math.max(4000, fc.high * 1.1)} />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ink-500">
                Calculated live by the same regression model used in the Prediction Center, trained on {model.rows.length} past drives.{' '}
                <Link to="/predict#how" className="font-semibold text-forest-700 underline underline-offset-2">See how it works</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="border-y border-cream-300/70 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-3">
          <div>
            <div className="eyebrow">The problem</div>
            <h2 className="mt-2 text-3xl font-semibold text-forest-900">Generosity isn't the bottleneck. Coordination is.</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3 lg:col-span-2">
            {[
              { t: 'Guesswork planning', d: 'Organizers guess how many boxes, volunteers, and vans they need, and end up scrambling or over-preparing.' },
              { t: 'Mismatched donations', d: 'Shelters get piles of what was easy to give, not the formula, protein, or produce they actually asked for.' },
              { t: 'Invisible gaps', d: 'Some neighborhoods host drives every season while others with greater need are rarely served.' },
            ].map((x, i) => (
              <div key={x.t}>
                <div className="font-display text-4xl font-semibold text-forest-200">0{i + 1}</div>
                <div className="mt-2 font-bold text-ink-900">{x.t}</div>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <div className="eyebrow">How NourishNet works</div>
          <h2 className="mt-2 text-3xl font-semibold text-forest-900 sm:text-4xl">From a plan to a delivered meal, in four steps.</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <BarChart3 />, t: 'Predict', d: 'A transparent regression forecasts pounds collected with an honest range, and sizes your volunteers, boxes, and vehicles.', to: '/predict' },
            { icon: <ShieldCheck />, t: 'Verify needs', d: 'Shelters post specific requests. Urgency comes from four published factors, not a black box.', to: '/shelters' },
            { icon: <GitCompareArrows />, t: 'Match', d: 'An allocation algorithm splits your collection across shelters and explains every recommendation.', to: '/match' },
            { icon: <Truck />, t: 'Deliver & learn', d: 'Optimized routes cut driving. Actual results retrain the model, so the next forecast gets better.', to: '/impact' },
          ].map((x, i) => (
            <Link to={x.to} key={x.t} className="card card-pad group transition-all hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-center justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest-50 text-forest-600">{x.icon}</div>
                <span className="font-display text-sm text-ink-300">Step {i + 1}</span>
              </div>
              <div className="mt-4 text-lg font-bold text-ink-900">{x.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{x.d}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest-700 opacity-70 group-hover:opacity-100">
                Open <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Who it's for + live needs */}
      <section className="bg-forest-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-forest-300">Built for three communities</div>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">One shared picture of supply and need.</h2>
            <div className="mt-8 space-y-5">
              {[
                { icon: <School size={20} />, t: 'Organizers', d: 'Schools, clubs, faith groups, and nonprofits planning a drive.', to: '/create', cta: 'Plan a drive' },
                { icon: <HandHeart size={20} />, t: 'Volunteers & donors', d: 'Find a nearby drive or a shift that fits your schedule.', to: '/volunteer', cta: 'Find a shift' },
                { icon: <Building2 size={20} />, t: 'Shelters & food banks', d: 'Post verified needs and receive what you actually asked for.', to: '/shelters', cta: 'See requests' },
              ].map((x) => (
                <Link key={x.t} to={x.to} className="group flex items-start gap-4 rounded-2xl border border-forest-700 p-4 transition-colors hover:bg-forest-800">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest-700 text-forest-100">{x.icon}</div>
                  <div className="flex-1">
                    <div className="font-bold">{x.t}</div>
                    <div className="text-sm text-forest-200">{x.d}</div>
                  </div>
                  <span className="hidden self-center text-sm font-semibold text-forest-200 group-hover:text-white sm:block">{x.cta} →</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-cream-100 p-6 text-ink-900 sm:p-7">
            <div className="flex items-center justify-between">
              <div className="font-display text-xl font-semibold text-forest-900">Most urgent requests right now</div>
              <ProvenanceBadge kind="sample" />
            </div>
            <div className="mt-5 space-y-3">
              {topShelters.map(({ s, u }) => (
                <Link key={s.id} to={`/shelters?focus=${s.id}`} className="block rounded-2xl bg-white p-4 shadow-card transition-shadow hover:shadow-lift">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">{s.name}</div>
                      <div className="text-xs text-ink-500">{s.kind} · {s.neighborhood}</div>
                    </div>
                    <UrgencyBadge level={u.level} score={u.score} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.needs.slice(0, 3).map((n) => (
                      <span key={n.label} className="rounded-full bg-cream-200 px-2.5 py-1 text-[11px] font-semibold text-ink-700">
                        {n.label}: {fmt(n.quantityNeeded - n.quantityReceived)} {n.unit}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
            <Link to="/shelters" className="btn-primary mt-5 w-full">See all verified needs</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <CalendarHeart className="mx-auto text-forest-500" size={36} />
        <h2 className="mt-4 text-3xl font-semibold text-forest-900 sm:text-4xl">Planning a drive this season?</h2>
        <p className="mx-auto mt-3 max-w-xl text-ink-500">Set it up in four steps and get a forecast, a supply checklist, volunteer shifts, and a shareable event page.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/create" className="btn-primary px-6 py-3 text-[15px]">Create a food drive</Link>
          <Link to="/dashboard" className="btn-secondary px-6 py-3 text-[15px]">Open the dashboard</Link>
        </div>
      </section>
    </div>
  );
}

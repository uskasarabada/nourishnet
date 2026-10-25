import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { BrainCircuit, Car, ChevronDown, Database, Gauge, Layers, Package, RefreshCw, Target, Users } from 'lucide-react';
import { useStore } from '../state/store';
import { CATEGORIES, LBS_PER_MEAL } from '../lib/categories';
import { ORG_LABEL, ORG_TYPES, describeModel, forecast, learningCurve, probabilityOfGoal, type DriveFeatures } from '../lib/forecast';
import { nearbyDemand, planResources } from '../lib/resources';
import type { FoodCategory, FoodDrive, OrgType } from '../lib/types';
import { NEIGHBORHOODS, neighborhoodCenter } from '../data/region';
import { addDays, todayISO } from '../lib/dates';
import { AXIS, Callout, Card, CardTitle, ChartTooltip, Details, GRID, Legend, PageHeader, ProvenanceBadge, Slider, cx, fmt } from '../components/ui';
import { CategoryMix, DataStrength, ForecastExplanation, RangeBar, ResourceCards } from '../components/forecastViews';
import { FEATURE_BY_ID } from '../components/features';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const F = FEATURE_BY_ID.plan;

export function Plan() {
  const { model, shelters, categoryShares, drives, dispatch } = useStore();
  const navigate = useNavigate();
  const loc = useLocation();
  const orgs = useMemo(() => Array.from(new Set(drives.map((d) => d.organization))).sort(), [drives]);

  const [orgType, setOrgType] = useState<OrgType>('school');
  const [organization, setOrganization] = useState('');
  const [hood, setHood] = useState('Riverside');
  const [participants, setParticipants] = useState(400);
  const [days, setDays] = useState(5);
  const [month, setMonth] = useState(new Date().getMonth());
  const [cats, setCats] = useState<FoodCategory[]>(['grains', 'protein', 'canned_veg', 'canned_fruit', 'breakfast']);
  const [goal, setGoal] = useState(1500);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(addDays(todayISO(), 14));
  const [error, setError] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(loc.hash === '#ai');

  const features: DriveFeatures = { orgType, organization: organization || undefined, participants, durationDays: days, month, categories: cats, location: neighborhoodCenter(hood) };
  const fc = forecast(model, features);
  const plan = planResources(fc, { participants, durationDays: days, categories: cats, shelterCount: shelters.length }, categoryShares);
  const demand = nearbyDemand(neighborhoodCenter(hood), shelters, shelters.length, cats);
  const pGoal = probabilityOfGoal(fc, goal);
  const cars = plan.vehicles.reduce((a, v) => a + v.count, 0);

  // What-if curve: forecast across a range of participant counts.
  const curve = useMemo(() => {
    const maxP = Math.max(1200, participants * 1.6);
    return Array.from({ length: 24 }, (_, i) => {
      const p = Math.round(50 + (i * (maxP - 50)) / 23);
      const f = forecast(model, { ...features, participants: p });
      return { participants: p, median: Math.round(f.median), band: [Math.round(f.low), Math.round(f.high)] as [number, number] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, orgType, organization, days, month, cats, hood, participants]);

  const toggleCat = (c: FoodCategory) => setCats((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));

  const createDrive = () => {
    const org = organization || 'Your group';
    if (name.trim().length < 3) return setError('Give your drive a name.');
    if (cats.length === 0) return setError('Pick at least one food type under "More options".');
    if (startDate < todayISO()) return setError('The start date must be today or later.');
    const id = `dr-new-${Date.now().toString(36)}`;
    const drive: FoodDrive = {
      id,
      name: name.trim(),
      organization: org,
      orgType,
      driveType: month >= 10 ? 'holiday' : orgType === 'school' ? 'school_challenge' : 'canned_goods',
      status: startDate <= todayISO() ? 'active' : 'upcoming',
      location: neighborhoodCenter(hood),
      address: hood,
      neighborhood: hood,
      startDate,
      durationDays: days,
      expectedParticipants: participants,
      acceptedCategories: cats,
      goalLbs: goal,
      predictedLbs: Math.round(fc.median),
      predictedLow: Math.round(fc.low),
      predictedHigh: Math.round(fc.high),
      collectedLbs: 0,
      collectedByCategory: {},
      dailyLog: [],
      shifts: [],
      description: `A ${days}-day food drive organized by ${org}.`,
      provenance: 'self-reported',
    };
    dispatch({ type: 'createDrive', drive });
    navigate(`/drives/${id}?created=1`);
  };

  const quick = [
    { icon: <Users size={20} />, label: 'Volunteers', value: fmt(plan.volunteers.total) },
    { icon: <Package size={20} />, label: 'Boxes', value: fmt(plan.boxes) },
    { icon: <Car size={20} />, label: 'Cars or vans', value: fmt(cars) },
    { icon: <Target size={20} />, label: `Chance of ${fmt(goal)} lb goal`, value: `${Math.round(pGoal * 100)}%` },
  ];

  return (
    <div>
      <PageHeader eyebrow="Plan a drive" accent={F.color} icon={F.icon} title="How much food will your drive collect?" subtitle="Answer a few questions and we'll tell you what to expect." />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr] 2xl:grid-cols-[420px_1fr]">
        {/* Questions */}
        <div className="space-y-6">
          <Card className="card-pad">
            <CardTitle title="Your drive" />
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="orgType">Who's running it?</label>
                  <select id="orgType" className="input" value={orgType} onChange={(e) => setOrgType(e.target.value as OrgType)}>
                    {ORG_TYPES.map((o) => <option key={o} value={o}>{ORG_LABEL[o]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="month">When?</label>
                  <select id="month" className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="hood">Where?</label>
                <select id="hood" className="input" value={hood} onChange={(e) => setHood(e.target.value)}>
                  {NEIGHBORHOODS.map((n) => <option key={n.name}>{n.name}</option>)}
                </select>
              </div>
              <Slider label="How many people will give?" value={participants} min={20} max={1500} step={10} onChange={setParticipants} format={fmt} />
              <Slider label="How many days?" value={days} min={1} max={21} onChange={setDays} format={(v) => `${v} day${v > 1 ? 's' : ''}`} />
              <Slider label="Your goal" value={goal} min={100} max={8000} step={50} onChange={setGoal} format={(v) => `${fmt(v)} lb`} />
              <Details label="More options" hideLabel="Fewer options">
                <div>
                  <label className="label" htmlFor="org">Group with past drives (optional)</label>
                  <select id="org" className="input" value={organization} onChange={(e) => setOrganization(e.target.value)}>
                    <option value="">New group</option>
                    {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <span className="label">Food types you'll accept</span>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button key={c.id} type="button" aria-pressed={cats.includes(c.id)} onClick={() => toggleCat(c.id)} className={cats.includes(c.id) ? 'chip-on' : 'chip-off'}>
                        <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                        {c.short}
                      </button>
                    ))}
                  </div>
                </div>
              </Details>
            </div>
          </Card>
        </div>

        {/* The answer */}
        <div className="space-y-6">
          <Card className="card-pad">
            <div className="text-sm font-semibold text-ink-500">You'll likely collect about</div>
            <div className="mt-1 font-display text-6xl font-semibold tabular" style={{ color: F.color }}>{fmt(Math.round(fc.median / 10) * 10)} lb</div>
            <p className="mt-2 text-lg text-ink-700">
              That's about <strong>{fmt(fc.median / LBS_PER_MEAL)} meals</strong>. Most likely somewhere between {fmt(fc.low)} and {fmt(fc.high)} lb.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {quick.map((q) => (
                <div key={q.label} className="rounded-2xl p-4" style={{ background: F.tint }}>
                  <div style={{ color: F.color }}>{q.icon}</div>
                  <div className="mt-2 font-display text-3xl font-semibold text-forest-900 tabular">{q.value}</div>
                  <div className="text-sm text-ink-500">{q.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3"><ProvenanceBadge kind="estimated" /></div>
          </Card>

          <section id="create" className="scroll-mt-24">
            <Card className="card-pad">
              <CardTitle title="Happy with this? Create your drive." />
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label className="label" htmlFor="dname">Drive name</label>
                  <input id="dname" className="input" placeholder="e.g. Riverside Winter Food Drive" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="dstart">Start date</label>
                  <input id="dstart" type="date" className="input" min={todayISO()} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <button className="btn-primary py-2.5" onClick={createDrive}>Create drive</button>
              </div>
              {error && <p role="alert" className="mt-2 text-sm font-semibold text-coral-700">{error}</p>}
            </Card>
          </section>

          <Details label="Show details" hideLabel="Hide details">
            <Card className="card-pad">
              <CardTitle title="The likely range" subtitle="The bar shows where the result will most likely land." />
              <RangeBar fc={fc} goal={goal} />
              <div className="mt-10"><DataStrength fc={fc} /></div>
            </Card>
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="card-pad">
                <CardTitle title="Why the model predicts this" subtitle="Each factor multiplies the one before it." icon={<BrainCircuit size={18} />} />
                <ForecastExplanation fc={fc} />
              </Card>
              <Card className="card-pad">
                <CardTitle title="What if more people join?" subtitle="Pounds collected as the number of people changes. Dot = your plan." />
                <div className="h-64">
                  <ResponsiveContainer>
                    <ComposedChart data={curve} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="participants" type="number" domain={['dataMin', 'dataMax']} {...AXIS} tickFormatter={(v) => fmt(v)} />
                      <YAxis {...AXIS} tickFormatter={(v) => fmt(v)} />
                      <Tooltip content={<ChartTooltip labelFormat={(l) => `${fmt(Number(l))} people`} />} />
                      <Area dataKey="band" name="Likely range" stroke="none" fill="#A9D3B9" fillOpacity={0.5} isAnimationActive={false} />
                      <Line dataKey="median" name="Most likely" stroke="#145536" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <ReferenceLine y={goal} stroke="#B57F05" strokeDasharray="4 4" label={{ value: 'Goal', position: 'insideTopLeft', fontSize: 11, fill: '#8A5F00' }} />
                      <ReferenceDot x={participants} y={Math.round(fc.median)} r={6} fill="#145536" stroke="#fff" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <Legend items={[{ label: 'Most likely', color: '#145536' }, { label: 'Likely range', color: '#A9D3B9' }, { label: 'Goal', color: '#B57F05', dashed: true }]} />
              </Card>
            </div>
            <Card className="card-pad">
              <CardTitle title="Full supply plan" right={<ProvenanceBadge kind="estimated" />} />
              <ResourceCards plan={plan} durationDays={days} />
            </Card>
            <Card className="card-pad">
              <CardTitle title="Which foods to ask for" subtitle="What you'll likely collect vs. what our partner shelters need" />
              <CategoryMix plan={plan} demand={demand.byCategory} />
            </Card>
          </Details>
        </div>
      </div>

      <section id="ai" className="mt-12 scroll-mt-24">
        <button
          onClick={() => setShowAI(!showAI)}
          aria-expanded={showAI}
          className="card flex w-full items-center justify-between gap-4 p-5 text-left transition-shadow hover:shadow-lift sm:p-6"
        >
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><BrainCircuit size={22} /></div>
            <div>
              <div className="font-display text-2xl font-semibold text-forest-900">How the AI works</div>
              <div className="text-sm text-ink-500">How the model learns, explains itself, and gets smarter.</div>
            </div>
          </div>
          <ChevronDown className={cx('shrink-0 text-ink-400 transition-transform', showAI && 'rotate-180')} />
        </button>
        {showAI && <ModelPanel />}
      </section>
    </div>
  );
}

const AI_STEPS = [
  {
    icon: <Database size={18} />,
    title: '1 · It learns from past drives',
    body: 'The model studies every completed drive: who ran it, how many people, how long, what month, and how much food came in. From that it learns patterns, like holiday drives collecting about 40% more.',
    term: 'Supervised learning (regression)',
  },
  {
    icon: <Layers size={18} />,
    title: '2 · It explains every prediction',
    body: 'Instead of a black box, each forecast is broken into factors (participants, length, season, food types, local history) so you can see exactly what pushed the number up or down.',
    term: 'Explainable AI · feature attribution',
  },
  {
    icon: <Gauge size={18} />,
    title: '3 · It is honest about uncertainty',
    body: 'It gives a range, not one number. The range widens when information is missing or there is little history nearby, so it never pretends to be more certain than it is.',
    term: 'Prediction intervals · Bayesian priors',
  },
  {
    icon: <RefreshCw size={18} />,
    title: '4 · It gets smarter over time',
    body: 'When a drive finishes, its real result is added to the training data and the model retrains instantly. The chart below shows its error dropping as history grows.',
    term: 'Online learning · backtesting',
  },
];

function ModelPanel() {
  const { model, backtest } = useStore();
  const d = describeModel(model);
  const curve = learningCurve(backtest.points);
  const scatter = backtest.points.map((p) => ({ actual: Math.round(p.actual), predicted: Math.round(p.predicted), inRange: p.actual >= p.low && p.actual <= p.high }));
  const maxV = Math.max(...scatter.map((s) => Math.max(s.actual, s.predicted))) * 1.05;

  return (
    <div className="mt-6 space-y-6 animate-rise">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {AI_STEPS.map((s) => (
          <div key={s.title} className="card card-pad">
            <div className="flex items-center gap-2 text-amber-700">{s.icon}<span className="text-sm font-bold text-ink-900">{s.title}</span></div>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{s.body}</p>
            <div className="mt-3 inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">{s.term}</div>
          </div>
        ))}
      </div>

      <Card className="card-pad">
        <CardTitle title="The model, precisely" subtitle="For anyone who wants the math" />
        <p className="rounded-xl bg-cream-100 p-3 font-mono text-xs leading-relaxed">
          log(pounds ÷ participants) = base[org type] + α·log(days) + β₁·cos(month) + β₂·sin(month) + γ·holiday + δ·log(food types ÷ 8)
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-500">
          Coefficients are fitted with <strong>regularized least squares toward sensible starting beliefs</strong> (a Bayesian MAP estimate):
          θ = (XᵀX + Λ)⁻¹(Xᵀy + Λθ₀). With little data the forecast stays close to those starting beliefs; with more data the data takes over.
          The 80% range combines how far past forecasts missed with the model's uncertainty about its own coefficients. All of it is written from
          scratch in TypeScript, with no machine-learning library, so every step can be inspected.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { k: 'Avg. error (MAPE)', v: `${Math.round(backtest.mape * 100)}%`, s: 'rolling backtest' },
          { k: 'Rule-of-thumb error', v: `${Math.round(backtest.baselineMape * 100)}%`, s: 'lb/participant baseline' },
          { k: '80% range hit rate', v: `${Math.round(backtest.coverage80 * 100)}%`, s: 'target: 80%' },
          { k: 'Bias', v: `${backtest.bias >= 0 ? '+' : ''}${Math.round(backtest.bias * 100)}%`, s: backtest.bias >= 0 ? 'slightly over-predicts' : 'slightly under-predicts' },
        ].map((x) => (
          <div key={x.k} className="card card-pad">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{x.k}</div>
            <div className="mt-1 font-display text-3xl font-semibold text-forest-900 tabular">{x.v}</div>
            <div className="text-xs text-ink-400">{x.s}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="card-pad">
          <CardTitle title="Predicted vs. actual" subtitle="Each dot is a past drive, predicted using only drives before it." right={<ProvenanceBadge kind="sample" />} />
          <div className="h-64">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid {...GRID} vertical />
                <XAxis type="number" dataKey="actual" name="Actual" domain={[0, maxV]} {...AXIS} tickFormatter={(v) => fmt(v)} label={{ value: 'Actual lb', position: 'insideBottomRight', offset: -2, fontSize: 11, fill: '#7D8781' }} />
                <YAxis type="number" dataKey="predicted" name="Predicted" domain={[0, maxV]} {...AXIS} tickFormatter={(v) => fmt(v)} />
                <ZAxis range={[60, 60]} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxV, y: maxV }]} stroke="#A9B0AB" strokeDasharray="4 4" />
                <Tooltip cursor={false} content={({ active, payload }) => active && payload?.length ? (
                  <div className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-xs shadow-lift">
                    <div>Actual: <strong>{fmt(Number(payload[0].payload.actual))} lb</strong></div>
                    <div>Predicted: <strong>{fmt(Number(payload[0].payload.predicted))} lb</strong></div>
                    <div className="text-ink-500">{payload[0].payload.inRange ? 'Inside 80% range' : 'Outside 80% range'}</div>
                  </div>
                ) : null} />
                <Scatter data={scatter.filter((s) => s.inRange)} name="Inside range" fill="#1f8a52" stroke="#fff" strokeWidth={1.5} />
                <Scatter data={scatter.filter((s) => !s.inRange)} name="Outside range" fill="#E0663F" stroke="#fff" strokeWidth={1.5} shape="diamond" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ label: 'Actual inside 80% range', color: '#1f8a52' }, { label: 'Outside range', color: '#E0663F' }, { label: 'Perfect prediction', color: '#A9B0AB', dashed: true }]} />
        </Card>

        <Card className="card-pad">
          <CardTitle title="The model learns as drives finish" subtitle="Average error over the last 8 forecasts, by how much history existed." />
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="trainingSize" {...AXIS} label={{ value: 'past drives available', position: 'insideBottomRight', offset: -2, fontSize: 11, fill: '#7D8781' }} />
                <YAxis {...AXIS} unit="%" />
                <Tooltip content={<ChartTooltip unit="%" labelFormat={(l) => `${l} past drives`} />} />
                <Line dataKey="baseline" name="Rule of thumb" stroke="#A9B0AB" strokeWidth={2} dot={false} strokeDasharray="5 4" />
                <Line dataKey="model" name="NourishNet model" stroke="#145536" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ label: 'NourishNet model', color: '#145536' }, { label: 'Rule of thumb', color: '#A9B0AB', dashed: true }]} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="card-pad">
          <CardTitle title="Learned seasonal pattern" subtitle="Multiplier on giving by month (1.0 = typical)." />
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={d.seasonByMonth.map((s) => ({ ...s, factor: Number(s.factor.toFixed(2)) }))} margin={{ top: 16, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" {...AXIS} />
                <YAxis {...AXIS} domain={[0, 'auto']} />
                <ReferenceLine y={1} stroke="#A9B0AB" />
                <Tooltip cursor={{ fill: '#F4EFE3' }} content={<ChartTooltip unit="×" />} />
                <Bar dataKey="factor" name="Season multiplier" fill="#1f8a52" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="card-pad">
          <CardTitle title="Learned base rates" subtitle="Pounds per participant for a 1-day drive, before other factors." />
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-400">
                <th className="pb-2 font-semibold">Organization</th>
                <th className="pb-2 text-right font-semibold">Prior</th>
                <th className="pb-2 text-right font-semibold">Learned</th>
              </tr>
            </thead>
            <tbody>
              {d.rates.map((r) => (
                <tr key={r.orgType} className="border-t border-cream-200">
                  <td className="py-2">{r.label}</td>
                  <td className="py-2 text-right text-ink-400 tabular">{r.prior.toFixed(2)}</td>
                  <td className="py-2 text-right font-semibold tabular">{r.lbsPerParticipant.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-500">
            Duration exponent α = <strong>{d.durationExponent.toFixed(2)}</strong> (doubling the length multiplies pounds by ×{(2 ** d.durationExponent).toFixed(2)}). Residual σ = {d.sigma.toFixed(2)} (log scale). Trained on {d.n} drives.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Callout title="Missing information">
          Unknown participant counts are estimated from the median of similar organizations, and the extra uncertainty is <em>added</em> to the range, so it visibly widens.
        </Callout>
        <Callout title="Little data">
          Priors act like a few imaginary drives of evidence. New organizations get a cautious, wide forecast labeled "Limited history" instead of false precision.
        </Callout>
        <Callout title="Validation">
          Every completed drive is a test case: we predict it using only earlier drives and compare. The error, range hit rate, and bias above update automatically.
        </Callout>
      </div>
    </div>
  );
}

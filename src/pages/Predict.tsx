import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { BrainCircuit, FlaskConical, History, Plus, Target, Trash2, Wand2 } from 'lucide-react';
import { useStore } from '../state/store';
import { CATEGORIES } from '../lib/categories';
import {
  ORG_LABEL,
  ORG_TYPES,
  describeModel,
  fitModel,
  forecast,
  learningCurve,
  participantsForGoal,
  probabilityOfGoal,
  type DriveFeatures,
  type TrainingRow,
} from '../lib/forecast';
import { nearbyDemand, planResources } from '../lib/resources';
import type { FoodCategory, OrgType } from '../lib/types';
import { NEIGHBORHOODS, neighborhoodCenter } from '../data/region';
import { AXIS, Callout, Card, CardTitle, ChartTooltip, GRID, Legend, PageHeader, ProvenanceBadge, Slider, cx, fmt } from '../components/ui';
import { CategoryMix, DataStrength, ForecastExplanation, RangeBar, ResourceCards } from '../components/forecastViews';
import { todayISO } from '../lib/dates';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface PastRow {
  lbs: number;
  participants: number;
  days: number;
  month: number;
}

export function Predict() {
  const { model, shelters, categoryShares, drives } = useStore();
  const navigate = useNavigate();
  const orgs = useMemo(() => Array.from(new Set(drives.map((d) => d.organization))).sort(), [drives]);

  const [orgType, setOrgType] = useState<OrgType>('school');
  const [organization, setOrganization] = useState('');
  const [hood, setHood] = useState('Riverside');
  const [participants, setParticipants] = useState(400);
  const [unknownParticipants, setUnknownParticipants] = useState(false);
  const [days, setDays] = useState(5);
  const [month, setMonth] = useState(new Date().getMonth());
  const [cats, setCats] = useState<FoodCategory[]>(['grains', 'protein', 'canned_veg', 'canned_fruit', 'breakfast']);
  const [shelterCount, setShelterCount] = useState(3);
  const [goal, setGoal] = useState(1500);
  const [past, setPast] = useState<PastRow[]>([]);

  // The organizer's own history (entered here) is added to the training data.
  const activeModel = useMemo(() => {
    if (!past.length) return model;
    const name = organization || 'Your organization';
    const extra: TrainingRow[] = past.map((p, i) => ({
      id: `you-${i}`,
      orgType,
      organization: name,
      participants: p.participants,
      plannedParticipants: p.participants,
      lbs: p.lbs,
      durationDays: p.days,
      month: p.month,
      categories: cats,
      location: neighborhoodCenter(hood),
      date: todayISO(),
    }));
    return fitModel([...model.rows, ...extra]);
  }, [model, past, organization, orgType, cats, hood]);

  const features: DriveFeatures = {
    orgType,
    organization: past.length ? organization || 'Your organization' : organization || undefined,
    participants: unknownParticipants ? undefined : participants,
    durationDays: days,
    month,
    categories: cats,
    location: neighborhoodCenter(hood),
  };
  const fc = forecast(activeModel, features);
  const plan = planResources(fc, { participants: fc.participantsUsed, durationDays: days, categories: cats, shelterCount }, categoryShares);
  const demand = nearbyDemand(neighborhoodCenter(hood), shelters, shelterCount, cats);
  const pGoal = probabilityOfGoal(fc, goal);
  const needP = participantsForGoal(fc, goal);

  // What-if curve: forecast across a range of participant counts.
  const curve = useMemo(() => {
    const maxP = Math.max(1200, participants * 1.6);
    return Array.from({ length: 24 }, (_, i) => {
      const p = Math.round(50 + (i * (maxP - 50)) / 23);
      const f = forecast(activeModel, { ...features, participants: p });
      return { participants: p, median: Math.round(f.median), band: [Math.round(f.low), Math.round(f.high)] as [number, number] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModel, orgType, organization, days, month, cats, hood, participants]);

  const toggleCat = (c: FoodCategory) => setCats((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));

  return (
    <div>
      <PageHeader
        eyebrow="Prediction Center"
        title="Forecast your food drive"
        subtitle="Describe your drive. NourishNet estimates what you will collect, with an honest range, and turns that into a supply and staffing plan."
        actions={
          <button
            className="btn-primary"
            onClick={() =>
              navigate('/create', { state: { prefill: { orgType, organization, hood, participants, days, cats, goal } } })
            }
          >
            <Wand2 size={16} /> Create a drive from this forecast
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Inputs */}
        <div className="space-y-6">
          <Card className="card-pad">
            <CardTitle title="About your drive" icon={<FlaskConical size={18} />} />
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="orgType">Organization type</label>
                <select id="orgType" className="input" value={orgType} onChange={(e) => setOrgType(e.target.value as OrgType)}>
                  {ORG_TYPES.map((o) => (
                    <option key={o} value={o}>{ORG_LABEL[o]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="org">Organization (optional)</label>
                <select id="org" className="input" value={organization} onChange={(e) => setOrganization(e.target.value)}>
                  <option value="">New / not listed</option>
                  {orgs.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-ink-400">Choosing an organization with past drives lets the model use its track record.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="hood">Location</label>
                  <select id="hood" className="input" value={hood} onChange={(e) => setHood(e.target.value)}>
                    {NEIGHBORHOODS.map((n) => (
                      <option key={n.name}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="month">Month</label>
                  <select id="month" className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <span className="label">Food types collected</span>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button key={c.id} type="button" aria-pressed={cats.includes(c.id)} onClick={() => toggleCat(c.id)} className={cats.includes(c.id) ? 'chip-on' : 'chip-off'}>
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                      {c.short}
                    </button>
                  ))}
                </div>
              </div>
              <Slider label="Shelters supported" value={shelterCount} min={1} max={6} onChange={setShelterCount} hint="Used to estimate nearby demand and delivery trips." />
            </div>
          </Card>

          <Card className="card-pad">
            <CardTitle title="What-if simulator" subtitle="Move a slider; every number updates instantly." icon={<Target size={18} />} />
            <div className="space-y-5">
              <div>
                <Slider label="Participants" value={participants} min={20} max={1500} step={10} onChange={(v) => { setParticipants(v); setUnknownParticipants(false); }} format={(v) => (unknownParticipants ? 'Unknown' : fmt(v))} />
                <label className="mt-2 flex items-center gap-2 text-xs text-ink-500">
                  <input type="checkbox" checked={unknownParticipants} onChange={(e) => setUnknownParticipants(e.target.checked)} className="accent-forest-600" />
                  I don't know yet. Estimate it from similar organizations.
                </label>
              </div>
              <Slider label="Event length" value={days} min={1} max={21} onChange={setDays} format={(v) => `${v} day${v > 1 ? 's' : ''}`} />
              <Slider label="Donation goal" value={goal} min={100} max={8000} step={50} onChange={setGoal} format={(v) => `${fmt(v)} lb`} />
            </div>
          </Card>

          <Card className="card-pad">
            <CardTitle title="Your past drives" subtitle="Add results from earlier events to personalize the forecast." icon={<History size={18} />} />
            {past.length > 0 && (
              <table className="mb-3 w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-400">
                    <th className="pb-1 font-semibold">Lb</th>
                    <th className="pb-1 font-semibold">People</th>
                    <th className="pb-1 font-semibold">Days</th>
                    <th className="pb-1 font-semibold">Month</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {past.map((p, i) => (
                    <tr key={i} className="border-t border-cream-200">
                      {(['lbs', 'participants', 'days'] as const).map((k) => (
                        <td key={k} className="py-1 pr-1">
                          <input aria-label={k} type="number" min={1} className="input px-2 py-1 text-xs" value={p[k]} onChange={(e) => setPast((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: Math.max(1, Number(e.target.value)) } : x)))} />
                        </td>
                      ))}
                      <td className="py-1 pr-1">
                        <select aria-label="month" className="input px-1 py-1 text-xs" value={p.month} onChange={(e) => setPast((xs) => xs.map((x, j) => (j === i ? { ...x, month: Number(e.target.value) } : x)))}>
                          {MONTHS.map((m, k) => (
                            <option key={m} value={k}>{m}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button aria-label="Remove row" className="p-1 text-ink-400 hover:text-coral-600" onClick={() => setPast((xs) => xs.filter((_, j) => j !== i))}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn-secondary w-full" onClick={() => setPast((xs) => [...xs, { lbs: 900, participants: 350, days: 5, month: 10 }])}>
              <Plus size={15} /> Add a past drive
            </button>
            {past.length > 0 && <p className="mt-2 text-[11px] text-ink-400">Model re-trained on {activeModel.rows.length} drives, including your {past.length}.</p>}
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <Card className="card-pad">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="eyebrow">Predicted collection · 80% range</div>
                <div className="mt-1 font-display text-5xl font-semibold text-forest-900 tabular">
                  {fmt(fc.low)}–{fmt(fc.high)} <span className="text-2xl text-ink-400">lb</span>
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  Most likely around <strong className="text-ink-900">{fmt(fc.median)} lb</strong> ({fc.ratePerParticipant.toFixed(1)} lb per participant).
                  {fc.participantsEstimated && <> Participants estimated at <strong>{fmt(fc.participantsUsed)}</strong> from similar organizations.</>}
                </p>
              </div>
              <div className="flex gap-3">
                <div className={cx('rounded-2xl px-4 py-3 text-center', pGoal >= 0.7 ? 'bg-forest-50' : pGoal >= 0.4 ? 'bg-amber-50' : 'bg-coral-50')}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Chance of goal</div>
                  <div className={cx('font-display text-3xl font-semibold tabular', pGoal >= 0.7 ? 'text-forest-700' : pGoal >= 0.4 ? 'text-amber-700' : 'text-coral-700')}>{Math.round(pGoal * 100)}%</div>
                  <div className="text-[11px] text-ink-500">of {fmt(goal)} lb</div>
                </div>
              </div>
            </div>
            <RangeBar fc={fc} goal={goal} />
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <DataStrength fc={fc} />
              <div className="rounded-xl border border-cream-300 bg-cream-50 p-3 text-xs text-ink-700">
                <div className="font-bold">To be ~90% confident of {fmt(goal)} lb</div>
                <div className="text-ink-500">
                  {needP <= fc.participantsUsed ? (
                    <>You're already there with {fmt(fc.participantsUsed)} participants.</>
                  ) : (
                    <>Aim for about <strong className="text-ink-900">{fmt(needP)} participants</strong>, or extend the drive.</>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="card-pad">
              <CardTitle title="How this forecast was built" subtitle="Each step multiplies the one before it." icon={<BrainCircuit size={18} />} />
              <ForecastExplanation fc={fc} />
            </Card>
            <Card className="card-pad">
              <CardTitle title="What-if: participants vs. pounds" subtitle={`Holding everything else fixed. Dot = your current plan.`} />
              <div className="h-64">
                <ResponsiveContainer>
                  <ComposedChart data={curve} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="participants" type="number" domain={['dataMin', 'dataMax']} {...AXIS} tickFormatter={(v) => fmt(v)} />
                    <YAxis {...AXIS} tickFormatter={(v) => fmt(v)} />
                    <Tooltip content={<ChartTooltip labelFormat={(l) => `${fmt(Number(l))} participants`} />} />
                    <Area dataKey="band" name="80% range" stroke="none" fill="#A9D3B9" fillOpacity={0.5} isAnimationActive={false} />
                    <Line dataKey="median" name="Most likely" stroke="#145536" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <ReferenceLine y={goal} stroke="#B57F05" strokeDasharray="4 4" label={{ value: 'Goal', position: 'insideTopLeft', fontSize: 11, fill: '#8A5F00' }} />
                    {!unknownParticipants && <ReferenceDot x={participants} y={Math.round(fc.median)} r={6} fill="#145536" stroke="#fff" strokeWidth={2} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <Legend items={[{ label: 'Most likely', color: '#145536' }, { label: '80% range', color: '#A9D3B9' }, { label: 'Goal', color: '#B57F05', dashed: true }]} />
            </Card>
          </div>

          <Card className="card-pad">
            <CardTitle title="Resource plan" subtitle="Sized from the forecast with published planning assumptions." right={<ProvenanceBadge kind="estimated" />} />
            <ResourceCards plan={plan} durationDays={days} />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="card-pad">
              <CardTitle title="Suggested food mix" subtitle="Expected pounds by category, compared with verified needs at nearby shelters." />
              <CategoryMix plan={plan} demand={demand.byCategory} />
            </Card>
            <Card className="card-pad">
              <CardTitle title="Predicted nearby demand" subtitle={`Open, verified requests at the ${shelterCount} closest shelters`} />
              <div className="flex items-end gap-3">
                <div className="font-display text-4xl font-semibold text-forest-900 tabular">{fmt(demand.total)} lb</div>
                <div className="pb-1 text-sm text-ink-500">
                  your drive could cover <strong className="text-ink-900">{Math.min(100, Math.round((fc.median / Math.max(1, demand.total)) * 100))}%</strong>
                </div>
              </div>
              <ul className="mt-4 divide-y divide-cream-200">
                {demand.shelters.map(({ s, miles }) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-ink-500">{s.kind} · {miles.toFixed(1)} mi</div>
                    </div>
                    <Link to={`/shelters?focus=${s.id}`} className="text-xs font-semibold text-forest-700 hover:underline">View needs</Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <ModelPanel />
        </div>
      </div>
    </div>
  );
}

function ModelPanel() {
  const { model, backtest } = useStore();
  const d = describeModel(model);
  const curve = learningCurve(backtest.points);
  const scatter = backtest.points.map((p) => ({ actual: Math.round(p.actual), predicted: Math.round(p.predicted), inRange: p.actual >= p.low && p.actual <= p.high }));
  const maxV = Math.max(...scatter.map((s) => Math.max(s.actual, s.predicted))) * 1.05;

  return (
    <section id="how" className="scroll-mt-24 space-y-6">
      <div className="pt-4">
        <div className="eyebrow">Transparency</div>
        <h2 className="mt-1 text-2xl font-semibold text-forest-900">How the forecast works, and how well it works</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-500">
          NourishNet uses a <strong>log-linear regression</strong>: pounds = participants × base rate × days<sup>α</sup> × season × variety × local track record.
          The coefficients are learned from completed drives with <strong>regularized least squares toward sensible priors</strong>, so with little data
          the forecast stays cautious, and with more data it adapts. The range comes from how far past forecasts missed (residual spread) plus the model's
          uncertainty about its own coefficients.
        </p>
      </div>

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
    </section>
  );
}

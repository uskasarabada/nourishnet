import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Marker } from 'react-leaflet';
import { Calendar, CheckCircle2, ClipboardCheck, Copy, FileText, GitCompareArrows, MapPin, PartyPopper, Plus, Scale, Users } from 'lucide-react';
import { useStore } from '../state/store';
import { forecast } from '../lib/forecast';
import { CATEGORY_BY_ID, LBS_PER_MEAL } from '../lib/categories';
import { addDays, daysFromToday, formatDate, monthOf, relativeDays } from '../lib/dates';
import type { FoodCategory, FoodDrive } from '../lib/types';
import { AXIS, Callout, Card, CardTitle, ChartTooltip, Empty, GRID, Legend, Progress, ProvenanceBadge, cx, fmt } from '../components/ui';
import { RangeBar } from '../components/forecastViews';
import { MapBase, STATUS_COLOR, pinIcon } from '../components/MapBase';
import { DRIVE_TYPE_LABEL } from './MapPage';
import { ORG_LABEL } from '../lib/forecast';

export function DriveDetails() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { driveById, model, backtest, drives, user, dispatch, shelterById } = useStore();
  const d = driveById(id ?? '');
  const [copied, setCopied] = useState(false);

  const fc = useMemo(() => {
    if (!d) return null;
    return forecast(model, { orgType: d.orgType, organization: d.organization, participants: d.expectedParticipants, durationDays: d.durationDays, month: monthOf(d.startDate), categories: d.acceptedCategories, location: d.location });
  }, [d, model]);

  if (!d || !fc) return <Empty title="Drive not found">It may have been removed when the demo was reset. <Link className="font-semibold text-forest-700 underline" to="/map">Back to the map</Link></Empty>;

  // Prefer the forecast saved at creation (or the honest backtest prediction) over a re-fit.
  const bt = backtest.points.find((p) => p.id === d.id);
  const saved = d.predictedLbs ? { median: d.predictedLbs, low: d.predictedLow!, high: d.predictedHigh! } : bt ? { median: bt.predicted, low: bt.low, high: bt.high } : null;
  const shown = saved ? { ...fc, ...saved } : fc;
  const collected = d.collectedLbs ?? 0;
  const elapsed = Math.min(d.durationDays, Math.max(0, -daysFromToday(d.startDate) + 1));
  const pace = d.status === 'active' && elapsed > 0 ? Math.round((collected / elapsed) * d.durationDays) : null;

  const share = async () => {
    const url = `${window.location.origin}/drives/${d.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copy this link:', url);
    }
  };

  const history = drives.filter((x) => x.organization === d.organization && x.status === 'completed' && x.id !== d.id);

  return (
    <div>
      {params.get('created') && (
        <div className="mb-6">
          <Callout title="Your drive is live!" icon={<PartyPopper size={16} />}>
            Share the event page link with your community. Your forecast has been saved so we can compare it with your results.
          </Callout>
        </div>
      )}

      {/* Hero */}
      <div className="card relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-forest-50 to-transparent md:block" aria-hidden />
        <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: STATUS_COLOR[d.status] }}>
                {d.status === 'active' ? 'Active now' : d.status === 'upcoming' ? `Starts ${relativeDays(d.startDate)}` : 'Completed'}
              </span>
              <span className="rounded-full bg-cream-200 px-2.5 py-0.5 text-[11px] font-semibold text-ink-700">{DRIVE_TYPE_LABEL[d.driveType]}</span>
              <ProvenanceBadge kind={d.provenance} />
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-forest-900 sm:text-4xl">{d.name}</h1>
            <p className="mt-2 max-w-2xl text-ink-500">{d.description}</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-700">
              <span className="flex items-center gap-1.5"><Users size={15} className="text-forest-500" />{d.organization} · {ORG_LABEL[d.orgType]}</span>
              <span className="flex items-center gap-1.5"><Calendar size={15} className="text-forest-500" />{formatDate(d.startDate)} – {formatDate(addDays(d.startDate, d.durationDays - 1))}</span>
              <span className="flex items-center gap-1.5"><MapPin size={15} className="text-forest-500" />{d.address}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2 md:flex-col md:items-stretch">
            <button className="btn-primary" onClick={share}>{copied ? <><ClipboardCheck size={16} /> Link copied</> : <><Copy size={16} /> Share event page</>}</button>
            <Link to={`/match?drive=${d.id}`} className="btn-secondary"><GitCompareArrows size={16} /> Match donations</Link>
            {d.status !== 'upcoming' && <Link to={`/drives/${d.id}/report`} className="btn-secondary"><FileText size={16} /> Impact report</Link>}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="card-pad">
            <CardTitle title={d.status === 'upcoming' ? 'Forecast' : 'Donation progress'} subtitle={saved ? 'Compared with the forecast made before the drive' : 'Current forecast'} />
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <div className="font-display text-5xl font-semibold text-forest-900 tabular">{fmt(collected)} <span className="text-xl text-ink-400">lb</span></div>
                <div className="text-sm text-ink-500">of {fmt(d.goalLbs)} lb goal · ≈{fmt(collected / LBS_PER_MEAL)} meals</div>
              </div>
              {pace !== null && <div className="rounded-xl bg-forest-50 px-3 py-2 text-sm text-forest-800">On pace for <strong>{fmt(pace)} lb</strong> by day {d.durationDays}</div>}
              {d.status === 'completed' && saved && (
                <div className={cx('rounded-xl px-3 py-2 text-sm', collected >= saved.low && collected <= saved.high ? 'bg-forest-50 text-forest-800' : 'bg-amber-50 text-amber-700')}>
                  Forecast was {fmt(saved.median)} lb: <strong>{collected >= saved.low && collected <= saved.high ? 'actual landed inside the range' : 'actual landed outside the range'}</strong> ({collected >= saved.median ? '+' : ''}{Math.round(((collected - saved.median) / saved.median) * 100)}%)
                </div>
              )}
            </div>
            <Progress className="mt-4 h-3" value={collected} max={d.goalLbs} label="Progress to goal" />
            <RangeBar fc={shown} goal={d.goalLbs} actual={d.status !== 'upcoming' ? collected : undefined} actualLabel={d.status === 'active' ? 'So far' : 'Actual'} />
            <div className="mt-8"><ProgressChart d={d} median={shown.median} low={shown.low} high={shown.high} /></div>
          </Card>

          {(d.status === 'active' || (d.status === 'upcoming' && daysFromToday(d.startDate) <= 0)) && <LogDonation d={d} onLog={(category, lbs) => dispatch({ type: 'logDonation', driveId: d.id, category, lbs })} />}
          {d.status === 'active' && <CompleteDrive d={d} onComplete={(n) => dispatch({ type: 'completeDrive', driveId: d.id, actualParticipants: n })} />}

          {d.collectedByCategory && collected > 0 && (
            <Card className="card-pad">
              <CardTitle title="What's been collected" />
              <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label="Collected pounds by category">
                {(Object.entries(d.collectedByCategory) as [FoodCategory, number][]).filter(([, v]) => v > 0).map(([c, v]) => (
                  <div key={c} style={{ width: `${(v / collected) * 100}%`, background: CATEGORY_BY_ID[c].color }} className="border-r-2 border-white last:border-r-0" title={`${CATEGORY_BY_ID[c].label}: ${fmt(v)} lb`} />
                ))}
              </div>
              <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {(Object.entries(d.collectedByCategory) as [FoodCategory, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                  <li key={c} className="flex justify-between"><span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORY_BY_ID[c].color }} />{CATEGORY_BY_ID[c].label}</span><span className="tabular">{fmt(v)} lb</span></li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="card-pad">
            <CardTitle title="Historical outcomes" subtitle={`Past drives by ${d.organization}`} />
            {history.length === 0 ? (
              <p className="text-sm text-ink-500">This is the organization's first drive on NourishNet. Its results will personalize future forecasts.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-ink-400"><th className="pb-2 font-semibold">Drive</th><th className="pb-2 text-right font-semibold">Predicted</th><th className="pb-2 text-right font-semibold">Actual</th><th className="pb-2 text-right font-semibold">Participants</th></tr></thead>
                <tbody>
                  {history.slice(-6).reverse().map((h) => {
                    const p = backtest.points.find((x) => x.id === h.id);
                    return (
                      <tr key={h.id} className="border-t border-cream-200">
                        <td className="py-2"><Link to={`/drives/${h.id}`} className="font-semibold hover:text-forest-700">{formatDate(h.startDate, { month: 'short', year: 'numeric' })}</Link> <span className="text-xs text-ink-400">{h.durationDays}d</span></td>
                        <td className="py-2 text-right text-ink-500 tabular">{p ? fmt(p.predicted) : '—'}</td>
                        <td className="py-2 text-right font-semibold tabular">{fmt(h.collectedLbs ?? 0)}</td>
                        <td className="py-2 text-right tabular">{fmt(h.actualParticipants ?? h.expectedParticipants)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <div className="card overflow-hidden">
            <MapBase height={220} center={d.location} zoom={13}>
              <Marker position={[d.location.lat, d.location.lng]} icon={pinIcon(STATUS_COLOR[d.status], { size: 20, pulse: d.status === 'active' })} />
            </MapBase>
          </div>
          <Card className="card-pad">
            <CardTitle title="Volunteer opportunities" subtitle={d.shifts.length ? `${d.shifts.reduce((a, s) => a + s.slots - s.filled, 0)} spots open` : undefined} />
            {d.status === 'completed' ? (
              <p className="text-sm text-ink-500">{d.volunteers} volunteers contributed {d.volunteerHours} hours.</p>
            ) : d.shifts.length === 0 ? (
              <p className="text-sm text-ink-500">No shifts posted.</p>
            ) : (
              <ul className="-mr-2 max-h-[560px] space-y-2 overflow-y-auto pr-2">
                {d.shifts.map((s) => {
                  const mine = user.signedUpShiftIds.includes(s.id);
                  const full = s.filled >= s.slots && !mine;
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-cream-300 p-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{s.role}</div>
                        <div className="text-xs text-ink-500">{formatDate(s.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {s.start}–{s.end} · {s.slots - s.filled} of {s.slots} open</div>
                      </div>
                      <button disabled={full || daysFromToday(s.date) < 0} onClick={() => dispatch({ type: 'toggleShift', shiftId: s.id, driveId: d.id })} className={mine ? 'btn bg-forest-50 px-3 py-1 text-xs text-forest-700' : 'btn-secondary px-3 py-1 text-xs'}>
                        {mine ? <><CheckCircle2 size={13} /> Signed up</> : full ? 'Full' : 'Sign up'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          {d.sheltersSupported && d.sheltersSupported.length > 0 && (
            <Card className="card-pad">
              <CardTitle title="Shelters supported" />
              <ul className="space-y-1.5 text-sm">
                {d.sheltersSupported.map((sid) => <li key={sid}><Link className="hover:text-forest-700" to={`/shelters?focus=${sid}`}>{shelterById(sid)?.name ?? sid}</Link></li>)}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressChart({ d, median, low, high }: { d: FoodDrive; median: number; low: number; high: number }) {
  // Expected cumulative trajectory: a straight-line pace to the forecast (kept simple on purpose).
  const data = Array.from({ length: d.durationDays }, (_, i) => {
    const day = addDays(d.startDate, i);
    const frac = (i + 1) / d.durationDays;
    const actual = d.dailyLog?.find((x) => x.day === day)?.lbs;
    return { day: formatDate(day, { month: 'short', day: 'numeric' }), expected: Math.round(median * frac), band: [Math.round(low * frac), Math.round(high * frac)] as [number, number], actual };
  });
  if (d.durationDays < 2) return null;
  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="day" {...AXIS} />
            <YAxis {...AXIS} tickFormatter={(v) => fmt(v)} />
            <Tooltip content={<ChartTooltip />} />
            <Area dataKey="band" name="Forecast range" stroke="none" fill="#D5EADD" fillOpacity={0.8} isAnimationActive={false} />
            <Line dataKey="expected" name="Forecast pace" stroke="#74B892" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="actual" name="Collected" stroke="#145536" strokeWidth={2.5} dot={{ r: 3.5, fill: '#145536' }} connectNulls isAnimationActive={false} />
            <ReferenceLine y={d.goalLbs} stroke="#B57F05" strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[{ label: 'Collected (cumulative)', color: '#145536' }, { label: 'Forecast pace', color: '#74B892', dashed: true }, { label: 'Forecast range', color: '#D5EADD' }, { label: 'Goal', color: '#B57F05', dashed: true }]} />
    </div>
  );
}

function LogDonation({ d, onLog }: { d: FoodDrive; onLog: (c: FoodCategory, lbs: number) => void }) {
  const [cat, setCat] = useState<FoodCategory>(d.acceptedCategories[0]);
  const [lbs, setLbs] = useState(25);
  const [flash, setFlash] = useState<string | null>(null);
  return (
    <Card className="card-pad">
      <CardTitle title="Log incoming donations" subtitle="Weigh a box or bin and record it. Totals and charts update instantly." icon={<Scale size={18} />} />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (lbs <= 0) return;
          onLog(cat, lbs);
          setFlash(`Added ${lbs} lb of ${CATEGORY_BY_ID[cat].label.toLowerCase()}`);
          setTimeout(() => setFlash(null), 2500);
        }}
      >
        <div className="min-w-[180px] flex-1">
          <label className="label" htmlFor="logcat">Category</label>
          <select id="logcat" className="input" value={cat} onChange={(e) => setCat(e.target.value as FoodCategory)}>
            {d.acceptedCategories.map((c) => <option key={c} value={c}>{CATEGORY_BY_ID[c].label}</option>)}
          </select>
        </div>
        <div className="w-32">
          <label className="label" htmlFor="loglbs">Pounds</label>
          <input id="loglbs" type="number" min={1} max={5000} className="input" value={lbs} onChange={(e) => setLbs(Number(e.target.value))} />
        </div>
        <button className="btn-primary" type="submit"><Plus size={16} /> Add</button>
      </form>
      <div aria-live="polite" className="mt-2 h-5 text-sm font-semibold text-forest-700">{flash}</div>
    </Card>
  );
}

function CompleteDrive({ d, onComplete }: { d: FoodDrive; onComplete: (participants: number) => void }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(d.expectedParticipants);
  return (
    <Card className="card-pad">
      <CardTitle title="Finish this drive" subtitle="Closing a drive adds its real results to the training data, and the forecast model re-trains immediately." icon={<CheckCircle2 size={18} />} />
      {open ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="label" htmlFor="actualp">Actual participants</label>
            <input id="actualp" type="number" min={1} className="input" value={n} onChange={(e) => setN(Number(e.target.value))} />
          </div>
          <button className="btn-primary" onClick={() => onComplete(Math.max(1, n))}>Mark complete & re-train</button>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setOpen(true)}>Close out drive</button>
      )}
    </Card>
  );
}

import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Marker, Polyline, Popup } from 'react-leaflet';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Lock, MinusCircle, RotateCcw, Unlock } from 'lucide-react';
import { useStore } from '../state/store';
import { CHUNK_LBS, DISTANCE_SCALE_MI, matchDonations, supplyFromLots, supplyFromTotals, type Allocation, type SupplyLine } from '../lib/matching';
import { forecast } from '../lib/forecast';
import { planResources } from '../lib/resources';
import { monthOf } from '../lib/dates';
import { CATEGORIES, CATEGORY_BY_ID } from '../lib/categories';
import type { FoodCategory, Shelter } from '../lib/types';
import { urgency, type UrgencyLevel } from '../lib/urgency';
import { MapBase, SHELTER_COLOR, STATUS_COLOR, pinIcon } from '../components/MapBase';
import { AXIS, Callout, Card, CardTitle, ChartTooltip, Details, GRID, Legend, PageHeader, ProvenanceBadge, Slider, UrgencyBadge, fmt } from '../components/ui';
import { FEATURE_BY_ID } from '../components/features';

const F = FEATURE_BY_ID.match;

/** One plain-English reason: what they asked for, plus the biggest urgency factor. */
function plainReason(a: Allocation, s: Shelter): string {
  const cats = (Object.entries(a.byCategory) as [FoodCategory, number][])
    .filter(([, v]) => v > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 2)
    .map(([c]) => CATEGORY_BY_ID[c].label.toLowerCase());
  const top = urgency(s).factors.slice().sort((x, y) => y.contribution - x.contribution)[0];
  return `They asked for ${cats.join(' and ')}. ${top.explanation}.`;
}

export function Match() {
  const { drives, shelters, model, categoryShares, dispatch } = useStore();
  const [params, setParams] = useSearchParams();
  const loc = useLocation();
  const recent = drives.filter((d) => d.status === 'completed').sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 2);
  const candidates = [...drives.filter((d) => d.status !== 'completed'), ...recent];
  const defaultId = drives.find((d) => d.status === 'active')?.id ?? candidates[0]?.id;
  const drive = drives.find((d) => d.id === (params.get('drive') ?? defaultId)) ?? drives.find((d) => d.id === defaultId)!;

  const [maxMiles, setMaxMiles] = useState(15);
  const [locks, setLocks] = useState<Record<string, number>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  // Supply: logged inventory for active drives, totals for finished ones, the forecast for upcoming ones.
  const { supply, source } = useMemo((): { supply: SupplyLine[]; source: string } => {
    if (drive.status === 'upcoming') {
      const fc = forecast(model, { orgType: drive.orgType, organization: drive.organization, participants: drive.expectedParticipants, durationDays: drive.durationDays, month: monthOf(drive.startDate), categories: drive.acceptedCategories, location: drive.location });
      const plan = planResources(fc, { participants: drive.expectedParticipants, durationDays: drive.durationDays, categories: drive.acceptedCategories, shelterCount: shelters.length }, categoryShares);
      return { supply: supplyFromTotals(Object.fromEntries(plan.categorySplit.map((c) => [c.category, c.lbs]))), source: "hasn't started yet, so this uses the expected amounts" };
    }
    if (drive.inventory?.length) return { supply: supplyFromLots(drive.inventory), source: 'has this food ready to give' };
    return { supply: supplyFromTotals(drive.collectedByCategory ?? {}), source: 'collected this food' };
  }, [drive, model, categoryShares, shelters.length]);

  const result = useMemo(() => matchDonations(drive.location, supply, shelters, { maxMiles, locks, excluded }), [drive, supply, shelters, maxMiles, locks, excluded]);
  const stacked = result.allocations.map((a) => ({ name: a.shelterName.split(' ').slice(0, 2).join(' '), full: a.shelterName, ...a.byCategory }));
  const usedCats = CATEGORIES.filter((c) => supply.some((s) => s.category === c.id));
  const shelterOf = (id: string) => shelters.find((s) => s.id === id)!;

  const pickDrive = (id: string) => {
    setParams({ drive: id });
    setLocks({});
    setExcluded([]);
    setConfirmed(false);
  };
  const unlock = (id: string) => setLocks((l) => { const n = { ...l }; delete n[id]; return n; });

  return (
    <div>
      <PageHeader eyebrow="Match donations" accent={F.color} light={F.light} icon={F.icon} title="Where should the food go?" subtitle="We split your drive's food between shelters based on what they asked for and who needs it most." />

      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="card-pad">
          <label className="label" htmlFor="drive">Food drive</label>
          <select id="drive" className="input text-base" value={drive.id} onChange={(e) => pickDrive(e.target.value)}>
            {candidates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <p className="mt-3 text-ink-700">
            This drive {source}: <strong>{fmt(result.totalSupply)} lb</strong>. Here's our suggestion:
          </p>
        </Card>

        {result.warnings.map((w) => <Callout key={w} tone="warn" icon={<AlertTriangle size={16} />}>{w}</Callout>)}

        <div className="space-y-3">
          {result.allocations.map((a) => (
            <div key={a.shelterId} className="card flex flex-wrap items-center gap-4 p-5" style={{ borderLeft: `5px solid ${F.color}` }}>
              <div className="w-28 shrink-0">
                <div className="font-display text-3xl font-semibold tabular" style={{ color: F.color }}>{fmt(a.totalLbs)}</div>
                <div className="text-sm text-ink-500">pounds</div>
              </div>
              <ArrowRight className="hidden shrink-0 text-ink-300 sm:block" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-ink-900">{a.shelterName}</span>
                  <UrgencyBadge level={a.urgencyLevel as UrgencyLevel} />
                  {a.locked && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: F.color }}><Lock size={10} /> Your choice</span>}
                </div>
                <p className="mt-1 text-ink-500">{plainReason(a, shelterOf(a.shelterId))}</p>
              </div>
            </div>
          ))}
          {result.allocations.length === 0 && <Card className="card-pad text-ink-500">No shelter nearby is asking for this food right now.</Card>}
        </div>

        {Object.keys(result.unallocated).length > 0 && (
          <p className="text-sm text-ink-500">
            <strong className="text-ink-700">Left over:</strong> {(Object.entries(result.unallocated) as [FoodCategory, number][]).map(([c, v]) => `${fmt(v)} lb ${CATEGORY_BY_ID[c].short.toLowerCase()}`).join(', ')}. No one is asking for more of this right now, so save it for the next request.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {confirmed ? (
            <span className="inline-flex items-center gap-2 font-semibold" style={{ color: F.color }}><CheckCircle2 size={18} /> Done! Shelter requests updated.</span>
          ) : (
            <button
              className="btn px-5 py-2.5 text-white"
              style={{ background: F.color }}
              disabled={drive.status === 'upcoming' || result.allocations.length === 0}
              title={drive.status === 'upcoming' ? 'Available once the drive has collected food' : undefined}
              onClick={() => {
                result.allocations.forEach((a) => dispatch({ type: 'updateShelterNeed', shelterId: a.shelterId, delivered: a.byCategory }));
                setConfirmed(true);
              }}
            >
              <Check size={16} /> Send it
            </button>
          )}
          <ProvenanceBadge kind={drive.status === 'upcoming' ? 'estimated' : 'sample'} />
        </div>

        <Details label="Adjust or see why" hideLabel="Hide" defaultOpen={loc.hash === '#how'}>
          <Card className="card-pad">
            <CardTitle title="What each shelter gets" />
            <div style={{ height: Math.max(110, stacked.length * 48) }}>
              <ResponsiveContainer>
                <BarChart data={stacked} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }} barCategoryGap={10}>
                  <CartesianGrid {...GRID} horizontal={false} vertical />
                  <XAxis type="number" {...AXIS} tickFormatter={(v) => fmt(v)} />
                  <YAxis type="category" dataKey="name" width={120} {...AXIS} tick={{ fill: '#3B4740', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#F4EFE3' }} content={<ChartTooltip labelFormat={(l) => String(stacked.find((s) => s.name === l)?.full ?? l)} />} />
                  {usedCats.map((c, i) => (
                    <Bar key={c.id} dataKey={c.id} name={c.short} stackId="a" fill={c.color} stroke="#fff" strokeWidth={2} radius={i === usedCats.length - 1 ? [0, 4, 4, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Legend items={usedCats.map((c) => ({ label: c.short, color: c.color }))} />
          </Card>

          <Card className="card-pad">
            <CardTitle title="Change the split" subtitle="Drag a slider to pick an amount yourself. It locks, and the rest re-balances automatically." />
            <div className="space-y-4">
              {result.allocations.map((a) => (
                <div key={a.shelterId} className="rounded-2xl border p-4" style={{ borderColor: a.locked ? F.color : F.border, background: F.tint }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{a.shelterName}</span>
                    <span className="font-display text-xl font-semibold tabular">{fmt(locks[a.shelterId] ?? a.totalLbs)} lb</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-ink-700">
                    {a.reasons.map((r) => <li key={r} className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0" style={{ color: F.color }} />{r}</li>)}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                      type="range"
                      className="slider max-w-sm flex-1"
                      min={0}
                      max={Math.round(result.totalSupply)}
                      step={CHUNK_LBS}
                      value={locks[a.shelterId] ?? a.totalLbs}
                      aria-label={`Pounds for ${a.shelterName}`}
                      style={{ ['--pct' as string]: `${((locks[a.shelterId] ?? a.totalLbs) / Math.max(1, result.totalSupply)) * 100}%` }}
                      onChange={(e) => setLocks((l) => ({ ...l, [a.shelterId]: Number(e.target.value) }))}
                    />
                    {a.locked && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => unlock(a.shelterId)}><Unlock size={13} /> Unlock</button>}
                    <button className="btn-ghost px-2 py-1 text-xs text-coral-700" onClick={() => { setExcluded((x) => [...x, a.shelterId]); unlock(a.shelterId); }}><MinusCircle size={13} /> Remove</button>
                  </div>
                </div>
              ))}
              {result.exclusions.map((e) => (
                <div key={e.shelterId} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-500">
                  <span><strong className="text-ink-700">{e.shelterName}:</strong> {e.reason}</span>
                  {excluded.includes(e.shelterId) && <button className="font-semibold underline" style={{ color: F.color }} onClick={() => setExcluded((x) => x.filter((y) => y !== e.shelterId))}>Add back</button>}
                </div>
              ))}
            </div>
            <div className="mt-5 max-w-sm"><Slider label="Farthest we'll drive" value={maxMiles} min={2} max={25} onChange={setMaxMiles} format={(v) => `${v} mi`} /></div>
            {(Object.keys(locks).length > 0 || excluded.length > 0) && (
              <button className="btn-secondary mt-4" onClick={() => { setLocks({}); setExcluded([]); }}><RotateCcw size={15} /> Undo my changes</button>
            )}
          </Card>

          <div className="card overflow-hidden">
            <MapBase height={320} fitTo={[drive.location, ...shelters.map((s) => s.location)]}>
              <Marker position={[drive.location.lat, drive.location.lng]} icon={pinIcon(STATUS_COLOR[drive.status], { size: 18, pulse: true })}><Popup>{drive.name}</Popup></Marker>
              {shelters.map((s) => <Marker key={s.id} position={[s.location.lat, s.location.lng]} icon={pinIcon(SHELTER_COLOR, { square: true, size: 15 })}><Popup>{s.name}</Popup></Marker>)}
              {result.allocations.map((a) => {
                const s = shelterOf(a.shelterId);
                return <Polyline key={a.shelterId} positions={[[drive.location.lat, drive.location.lng], [s.location.lat, s.location.lng]]} pathOptions={{ color: F.color, weight: 2 + (6 * a.totalLbs) / Math.max(1, result.totalSupply), opacity: 0.8 }} />;
              })}
            </MapBase>
            <div className="px-4 py-2 text-[11px] text-ink-500">Thicker line = more food</div>
          </div>

          <section id="how" className="scroll-mt-24">
            <Card className="card-pad">
              <CardTitle title="How the matching algorithm works" />
              <div className="grid gap-5 text-sm text-ink-700 md:grid-cols-2">
                <div>
                  <p>Food is handed out in {CHUNK_LBS}-lb portions. Each portion goes to the shelter request with the highest score:</p>
                  <p className="mt-2 rounded-xl p-3 font-mono text-xs" style={{ background: F.tint }}>score = urgency/100 × √(still needed ÷ requested) × 1/(1 + miles/{DISTANCE_SCALE_MI})</p>
                  <ul className="mt-3 space-y-1 text-xs text-ink-500">
                    <li><strong className="text-ink-700">Urgency</strong>: more urgent shelters are served first (see the <Link className="underline" to="/shelters#urgency">urgency score</Link>).</li>
                    <li><strong className="text-ink-700">√ still needed</strong>: as a request fills up, its pull weakens, so food spreads across shelters.</li>
                    <li><strong className="text-ink-700">Distance</strong>: closer shelters are slightly preferred.</li>
                  </ul>
                </div>
                <ul className="space-y-2 text-xs text-ink-500">
                  <li><strong className="text-ink-700">Hard rules (never broken):</strong> only food a shelter asked for · never more than they asked for · only what fits in their storage · fresh food only to shelters with a fridge · food must not expire before the shelter can hand it out.</li>
                  <li><strong className="text-ink-700">You stay in control:</strong> locked amounts are given first, then the rest is re-balanced.</li>
                </ul>
              </div>
            </Card>
          </section>
        </Details>
      </div>
    </div>
  );
}

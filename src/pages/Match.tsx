import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Marker, Polyline, Popup } from 'react-leaflet';
import { AlertTriangle, Check, CheckCircle2, GitCompareArrows, Lock, MinusCircle, RotateCcw, Route, Timer, Unlock } from 'lucide-react';
import { useStore } from '../state/store';
import { CHUNK_LBS, DISTANCE_SCALE_MI, matchDonations, supplyFromLots, supplyFromTotals, type SupplyLine } from '../lib/matching';
import { planRoutes } from '../lib/routing';
import { VEHICLES } from '../lib/resources';
import { forecast } from '../lib/forecast';
import { planResources } from '../lib/resources';
import { monthOf } from '../lib/dates';
import { wasteAlerts } from '../lib/waste';
import { CATEGORIES, CATEGORY_BY_ID } from '../lib/categories';
import type { FoodCategory } from '../lib/types';
import { MapBase, SHELTER_COLOR, STATUS_COLOR, pinIcon } from '../components/MapBase';
import { AXIS, Callout, Card, CardTitle, ChartTooltip, GRID, Legend, PageHeader, ProvenanceBadge, Slider, UrgencyBadge, cx, fmt } from '../components/ui';
import { formatMiles } from '../lib/geo';
import type { UrgencyLevel } from '../lib/urgency';

const ROUTE_COLORS = ['#145536', '#2a78d6', '#e0663f', '#6d5bd0'];

export function Match() {
  const { drives, shelters, model, categoryShares, dispatch } = useStore();
  const [params, setParams] = useSearchParams();
  const candidates = drives.filter((d) => d.status !== 'completed' || (d.collectedLbs ?? 0) > 0);
  const defaultId = drives.find((d) => d.status === 'active')?.id ?? candidates[0]?.id;
  const driveId = params.get('drive') ?? defaultId;
  const drive = drives.find((d) => d.id === driveId) ?? drives.find((d) => d.id === defaultId)!;

  const [maxMiles, setMaxMiles] = useState(12);
  const [locks, setLocks] = useState<Record<string, number>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [vehicle, setVehicle] = useState<(typeof VEHICLES)[number]['id']>('van');
  const [confirmed, setConfirmed] = useState(false);

  // Supply: real lots for active drives, logged totals for completed, forecast for upcoming.
  const { supply, source } = useMemo((): { supply: SupplyLine[]; source: string } => {
    if (drive.status === 'upcoming') {
      const fc = forecast(model, { orgType: drive.orgType, organization: drive.organization, participants: drive.expectedParticipants, durationDays: drive.durationDays, month: monthOf(drive.startDate), categories: drive.acceptedCategories, location: drive.location });
      const plan = planResources(fc, { participants: drive.expectedParticipants, durationDays: drive.durationDays, categories: drive.acceptedCategories, shelterCount: 3 }, categoryShares);
      return { supply: supplyFromTotals(Object.fromEntries(plan.categorySplit.map((c) => [c.category, c.lbs]))), source: 'Forecast (drive has not started), plan ahead with expected amounts' };
    }
    if (drive.inventory?.length) return { supply: supplyFromLots(drive.inventory), source: 'Logged inventory lots with expiration dates' };
    return { supply: supplyFromTotals(drive.collectedByCategory ?? {}), source: 'Collected totals by category' };
  }, [drive, model, categoryShares]);

  const result = useMemo(() => matchDonations(drive.location, supply, shelters, { maxMiles, locks, excluded }), [drive, supply, shelters, maxMiles, locks, excluded]);
  const cap = VEHICLES.find((v) => v.id === vehicle)!.capacityLbs;
  const routes = useMemo(
    () => planRoutes(drive.location, result.allocations.map((a) => ({ id: a.shelterId, name: a.shelterName, location: shelters.find((s) => s.id === a.shelterId)!.location, lbs: a.totalLbs })), cap),
    [result, drive, shelters, cap],
  );
  const alerts = wasteAlerts([drive], shelters);

  const stacked = result.allocations.map((a) => ({ name: a.shelterName.replace(/ (Family|Regional|Community|Neighborhood|Youth & Family|Veterans|Mobile Pantry|Senior|Campus|Women & Children) .*$/, ''), full: a.shelterName, ...a.byCategory }));
  const usedCats = CATEGORIES.filter((c) => supply.some((s) => s.category === c.id));

  const pickDrive = (id: string) => {
    setParams({ drive: id });
    setLocks({});
    setExcluded([]);
    setConfirmed(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Smart Matching"
        title="Send every pound where it's needed most"
        subtitle="The algorithm splits a drive's food across verified shelter requests, explains every choice, and lets you adjust anything before you deliver."
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card className="card-pad">
            <CardTitle title="Food drive" icon={<GitCompareArrows size={18} />} />
            <select aria-label="Choose a food drive" className="input" value={drive.id} onChange={(e) => pickDrive(e.target.value)}>
              {(['active', 'upcoming', 'completed'] as const).map((st) => (
                <optgroup key={st} label={st[0].toUpperCase() + st.slice(1)}>
                  {candidates.filter((d) => d.status === st).slice(-12).reverse().map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="mt-3 text-xs text-ink-500">{source}.</div>
            <div className="mt-4 space-y-1.5">
              {supply.map((l) => (
                <div key={l.category} className="flex items-center justify-between text-sm">
                  <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORY_BY_ID[l.category].color }} />{CATEGORY_BY_ID[l.category].label}</span>
                  <span className="tabular font-semibold">
                    {fmt(l.lbs)} lb
                    {l.daysToExpiry !== Infinity && <span className={cx('ml-1.5 text-[11px]', l.daysToExpiry <= 5 ? 'text-coral-600' : 'text-amber-700')}>· {l.daysToExpiry}d</span>}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-cream-200 pt-1.5 text-sm font-bold">
                <span>Total</span>
                <span className="tabular">{fmt(result.totalSupply)} lb</span>
              </div>
            </div>
          </Card>

          <Card className="card-pad space-y-5">
            <Slider label="Maximum delivery distance" value={maxMiles} min={2} max={25} onChange={setMaxMiles} format={(v) => `${v} mi`} />
            <div>
              <label className="label" htmlFor="veh">Delivery vehicle</label>
              <select id="veh" className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value as typeof vehicle)}>
                {VEHICLES.map((v) => (
                  <option key={v.id} value={v.id}>{v.label} (up to {fmt(v.capacityLbs)} lb)</option>
                ))}
              </select>
            </div>
            {(Object.keys(locks).length > 0 || excluded.length > 0) && (
              <button className="btn-secondary w-full" onClick={() => { setLocks({}); setExcluded([]); }}>
                <RotateCcw size={15} /> Reset my adjustments
              </button>
            )}
          </Card>

          {alerts.length > 0 && (
            <Card className="card-pad">
              <CardTitle title="Food waste prevention" subtitle="Lots expiring within 10 days" icon={<Timer size={18} className="text-coral-600" />} />
              <div className="space-y-3">
                {alerts.map((a) => (
                  <div key={a.lot.id} className={cx('rounded-xl border p-3 text-xs', a.severity === 'urgent' ? 'border-coral-100 bg-coral-50' : 'border-amber-100 bg-amber-50')}>
                    <div className="font-bold text-ink-900">{fmt(a.lot.lbs)} lb {CATEGORY_BY_ID[a.lot.category].label.toLowerCase()}, expires in {a.daysLeft} days</div>
                    {a.lot.note && <div className="text-ink-500">{a.lot.note}</div>}
                    <div className="mt-2 font-semibold text-ink-700">Can use it in time:</div>
                    <ul className="mt-1 space-y-0.5">
                      {a.recipients.length ? a.recipients.map((r) => <li key={r.shelter.id}>• <strong>{r.shelter.name}</strong> ({r.miles.toFixed(1)} mi). {r.why}</li>) : <li>No partner can distribute it in time. Consider a same-day community meal.</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card card-pad">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Allocated</div>
              <div className="mt-1 font-display text-3xl font-semibold text-forest-900 tabular">{fmt(result.totalAllocated)} <span className="text-base text-ink-400">/ {fmt(result.totalSupply)} lb</span></div>
            </div>
            <div className="card card-pad">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Shelters served</div>
              <div className="mt-1 font-display text-3xl font-semibold text-forest-900 tabular">{result.allocations.length}</div>
            </div>
            <div className="card card-pad">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Route savings</div>
              <div className="mt-1 font-display text-3xl font-semibold text-forest-900 tabular">{Math.round(routes.savedPct * 100)}%</div>
              <div className="text-xs text-ink-500">{formatMiles(routes.totalMiles)} vs {formatMiles(routes.naiveMiles)} separate trips</div>
            </div>
          </div>

          {result.warnings.map((w) => (
            <Callout key={w} tone="warn" icon={<AlertTriangle size={16} />}>{w}</Callout>
          ))}

          <Card className="card-pad">
            <CardTitle title="Recommended allocation" subtitle="Drag a slider to set an amount yourself. It locks, and the rest re-balances automatically." right={<ProvenanceBadge kind={drive.status === 'upcoming' ? 'estimated' : 'sample'} />} />
            {stacked.length > 0 && (
              <>
                <div style={{ height: Math.max(120, stacked.length * 44) }}>
                  <ResponsiveContainer>
                    <BarChart data={stacked} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }} barCategoryGap={10}>
                      <CartesianGrid {...GRID} horizontal={false} vertical />
                      <XAxis type="number" {...AXIS} tickFormatter={(v) => fmt(v)} />
                      <YAxis type="category" dataKey="name" width={130} {...AXIS} tick={{ fill: '#3B4740', fontSize: 12 }} />
                      <Tooltip cursor={{ fill: '#F4EFE3' }} content={<ChartTooltip labelFormat={(l) => String(stacked.find((s) => s.name === l)?.full ?? l)} />} />
                      {usedCats.map((c, i) => (
                        <Bar key={c.id} dataKey={c.id} name={c.short} stackId="a" fill={c.color} stroke="#fff" strokeWidth={2} radius={i === usedCats.length - 1 ? [0, 4, 4, 0] : 0} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Legend items={usedCats.map((c) => ({ label: c.short, color: c.color }))} />
              </>
            )}
            <div className="mt-5 space-y-3">
              {result.allocations.map((a) => (
                <div key={a.shelterId} className={cx('rounded-2xl border p-4', a.locked ? 'border-forest-300 bg-forest-50/50' : 'border-cream-300 bg-cream-50')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{a.shelterName}</span>
                        <UrgencyBadge level={a.urgencyLevel as UrgencyLevel} score={a.urgencyScore} />
                        {a.locked && <span className="inline-flex items-center gap-1 rounded-full bg-forest-700 px-2 py-0.5 text-[10px] font-bold text-white"><Lock size={10} /> Your choice</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(Object.entries(a.byCategory) as [FoodCategory, number][]).filter(([, v]) => v > 0).map(([c, v]) => (
                          <span key={c} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-700 ring-1 ring-cream-300">
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: CATEGORY_BY_ID[c].color }} />
                            {CATEGORY_BY_ID[c].short} {fmt(v)} lb
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-semibold text-forest-900 tabular">{fmt(a.totalLbs)} lb</div>
                      <div className="text-xs text-ink-500">{a.needFilledPct}% of their request</div>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-ink-700">
                    {a.reasons.map((r) => (
                      <li key={r} className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-forest-500" />{r}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                      type="range"
                      className="slider max-w-xs flex-1"
                      min={0}
                      max={Math.round(result.totalSupply)}
                      step={CHUNK_LBS}
                      value={locks[a.shelterId] ?? a.totalLbs}
                      aria-label={`Pounds for ${a.shelterName}`}
                      style={{ ['--pct' as string]: `${((locks[a.shelterId] ?? a.totalLbs) / Math.max(1, result.totalSupply)) * 100}%` }}
                      onChange={(e) => setLocks((l) => ({ ...l, [a.shelterId]: Number(e.target.value) }))}
                    />
                    {a.locked ? (
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setLocks((l) => { const n = { ...l }; delete n[a.shelterId]; return n; })}><Unlock size={13} /> Unlock</button>
                    ) : null}
                    <button className="btn-ghost px-2 py-1 text-xs text-coral-700" onClick={() => { setExcluded((x) => [...x, a.shelterId]); setLocks((l) => { const n = { ...l }; delete n[a.shelterId]; return n; }); }}>
                      <MinusCircle size={13} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {Object.keys(result.unallocated).length > 0 && (
              <div className="mt-4 rounded-xl border border-dashed border-cream-300 p-3 text-xs text-ink-500">
                <strong className="text-ink-700">Not yet matched:</strong>{' '}
                {(Object.entries(result.unallocated) as [FoodCategory, number][]).map(([c, v]) => `${fmt(v)} lb ${CATEGORY_BY_ID[c].short.toLowerCase()}`).join(', ')}.
                No in-range shelter currently requests more of this. Increase the distance or hold it for the next request.
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {confirmed ? (
                <span className="inline-flex items-center gap-2 font-semibold text-forest-700"><CheckCircle2 size={18} /> Delivery plan confirmed. Shelter requests updated.</span>
              ) : (
                <button
                  className="btn-primary"
                  disabled={drive.status === 'upcoming' || result.allocations.length === 0}
                  title={drive.status === 'upcoming' ? 'Available once the drive has collected food' : undefined}
                  onClick={() => {
                    result.allocations.forEach((a) => dispatch({ type: 'updateShelterNeed', shelterId: a.shelterId, delivered: a.byCategory }));
                    setConfirmed(true);
                  }}
                >
                  <Check size={16} /> Confirm & record deliveries
                </button>
              )}
              <Link to={`/drives/${drive.id}/report`} className="btn-secondary">Impact report</Link>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <div className="card overflow-hidden">
              <MapBase height={380} center={drive.location} zoom={12} fitTo={[drive.location, ...result.allocations.map((a) => shelters.find((s) => s.id === a.shelterId)!.location)]}>
                <Marker position={[drive.location.lat, drive.location.lng]} icon={pinIcon(STATUS_COLOR[drive.status], { size: 20, pulse: true })}>
                  <Popup>{drive.name} (pickup)</Popup>
                </Marker>
                {result.allocations.map((a) => {
                  const s = shelters.find((x) => x.id === a.shelterId)!;
                  return (
                    <Marker key={a.shelterId} position={[s.location.lat, s.location.lng]} icon={pinIcon(SHELTER_COLOR, { square: true, size: 15 })}>
                      <Popup>{a.shelterName}: {fmt(a.totalLbs)} lb</Popup>
                    </Marker>
                  );
                })}
                {routes.trips.map((t, i) => (
                  <Polyline key={i} positions={[[drive.location.lat, drive.location.lng], ...t.stops.map((s) => [s.location.lat, s.location.lng] as [number, number]), [drive.location.lat, drive.location.lng]]} pathOptions={{ color: ROUTE_COLORS[i % ROUTE_COLORS.length], weight: 3, dashArray: '6 6' }} />
                ))}
              </MapBase>
            </div>
            <Card className="card-pad">
              <CardTitle title="Delivery plan" subtitle="Nearest-neighbor + 2-opt, split by vehicle capacity" icon={<Route size={18} />} />
              <ol className="space-y-4">
                {routes.trips.map((t, i) => (
                  <li key={i}>
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ROUTE_COLORS[i % ROUTE_COLORS.length] }} />Trip {i + 1}</span>
                      <span className="tabular text-ink-500">{fmt(t.loadLbs)} lb · {formatMiles(t.miles)}</span>
                    </div>
                    <ol className="ml-5 mt-1 list-decimal space-y-0.5 text-xs text-ink-700">
                      {t.stops.map((s, j) => <li key={j}>{s.name}: drop {fmt(s.lbs)} lb</li>)}
                    </ol>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[11px] text-ink-400">Distances are straight-line × 1.3 road factor. Production would use a routing API.</p>
            </Card>
          </div>

          {result.exclusions.length > 0 && (
            <Card className="card-pad">
              <CardTitle title="Why some shelters weren't included" />
              <ul className="divide-y divide-cream-200 text-sm">
                {result.exclusions.map((e) => (
                  <li key={e.shelterId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-semibold">{e.shelterName}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-500">
                      {e.reason}
                      {excluded.includes(e.shelterId) && (
                        <button className="font-semibold text-forest-700 underline" onClick={() => setExcluded((x) => x.filter((y) => y !== e.shelterId))}>Add back</button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="card-pad" as="section">
            <div id="how" className="scroll-mt-24" />
            <CardTitle title="How the matching algorithm works" />
            <div className="grid gap-4 text-sm text-ink-700 md:grid-cols-2">
              <div>
                <p>Food is handed out in {CHUNK_LBS}-lb chunks. Each chunk goes to the feasible shelter request with the highest score:</p>
                <p className="mt-2 rounded-xl bg-cream-100 p-3 font-mono text-xs">score = urgency/100 × √(remaining ÷ requested) × 1/(1 + miles/{DISTANCE_SCALE_MI})</p>
                <p className="mt-2 text-xs text-ink-500">The square root gives diminishing returns, so food spreads across shelters instead of all going to the single most urgent one. Distance favors shorter trips and fresher deliveries.</p>
              </div>
              <ul className="space-y-1.5 text-xs text-ink-500">
                <li><strong className="text-ink-700">Hard constraints:</strong> within max distance · shelter requested that category · storage room available · perishables only to refrigerated sites · food must not expire before the shelter's typical distribution time.</li>
                <li><strong className="text-ink-700">Your adjustments:</strong> a slider locks that shelter's total; locked amounts are allocated first, then everything else is re-optimized.</li>
                <li><strong className="text-ink-700">Safety:</strong> requests not verified in 14 days are flagged so you confirm before delivering.</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

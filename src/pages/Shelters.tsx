import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Marker, Popup } from 'react-leaflet';
import { BadgeCheck, Clock, Mail, Phone, Refrigerator, Search, ShieldCheck, Siren, TrendingDown, TrendingUp, Truck } from 'lucide-react';
import { useStore } from '../state/store';
import { useEmergency } from '../components/Layout';
import { MapBase, pinIcon } from '../components/MapBase';
import { AXIS, Callout, Card, CardTitle, ChartTooltip, Empty, GRID, Legend, PageHeader, Progress, ProvenanceBadge, URGENCY_STYLE, UrgencyBadge, cx, fmt } from '../components/ui';
import { STALE_AFTER_DAYS, STALE_DISCOUNT, URGENCY_WEIGHTS, urgency, type UrgencyLevel } from '../lib/urgency';
import { forecastShelterNeed } from '../lib/needForecast';
import { CATEGORIES, CATEGORY_BY_ID } from '../lib/categories';
import type { FoodCategory, Shelter } from '../lib/types';
import { relativeDays } from '../lib/dates';

export function Shelters() {
  const { shelters, drives, dispatch } = useStore();
  const emergency = useEmergency();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | FoodCategory>('all');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState<'urgency' | 'name' | 'verified'>('urgency');
  const focusId = params.get('focus');

  const rows = useMemo(() => {
    const scored = shelters.map((s) => ({ s, u: urgency(s), f: forecastShelterNeed(s) }));
    return scored
      .filter(({ s, u }) => {
        if (emergency.on && (!(u.level === 'Critical' || u.level === 'High') || u.daysSinceVerified > 3)) return false;
        if (q && !`${s.name} ${s.neighborhood} ${s.needs.map((n) => n.label).join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (cat !== 'all' && !s.needs.some((n) => n.category === cat && n.quantityReceived < n.quantityNeeded)) return false;
        if (kind !== 'all' && s.kind !== kind) return false;
        return true;
      })
      .sort((a, b) => (sort === 'urgency' ? b.u.score - a.u.score : sort === 'name' ? a.s.name.localeCompare(b.s.name) : a.u.daysSinceVerified - b.u.daysSinceVerified));
  }, [shelters, q, cat, kind, sort, emergency.on]);

  const focus = rows.find((r) => r.s.id === focusId) ?? null;
  const setFocus = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('focus', id);
    else p.delete('focus');
    setParams(p, { replace: true });
  };
  const shortages = rows.filter((r) => r.f.shortageWeek !== null && r.f.shortageWeek <= 3).length;
  const activeDrives = drives.filter((d) => d.status === 'active');

  return (
    <div>
      <PageHeader
        eyebrow="Shelter Needs"
        title="Verified requests from local partners"
        subtitle="Each organization posts what it needs and how much. Urgency is calculated from four published factors, so anyone can see why a request ranks where it does."
      />

      {emergency.on && (
        <div className="mb-4">
          <Callout tone="alert" icon={<Siren size={16} />} title="Emergency Response Mode">
            Showing {rows.length} Critical/High request{rows.length === 1 ? '' : 's'} verified in the last 72 hours. Stale or lower-priority requests are hidden so responders can act fast.
          </Callout>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card card-pad">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Critical or high</div>
          <div className="mt-1 font-display text-3xl font-semibold text-coral-700 tabular">{rows.filter((r) => r.u.level === 'Critical' || r.u.level === 'High').length}</div>
        </div>
        <div className="card card-pad">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Forecast shortage ≤ 3 weeks</div>
          <div className="mt-1 font-display text-3xl font-semibold text-amber-700 tabular">{shortages}</div>
        </div>
        <div className="card card-pad">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Open need</div>
          <div className="mt-1 font-display text-3xl font-semibold text-forest-900 tabular">{fmt(rows.reduce((a, r) => a + r.u.unmetLbs, 0))} lb</div>
        </div>
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search shelters, neighborhoods, or items (e.g. formula)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search shelters" />
        </div>
        <select aria-label="Needed category" className="input w-auto py-2 text-sm" value={cat} onChange={(e) => setCat(e.target.value as 'all' | FoodCategory)}>
          <option value="all">Any food type</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select aria-label="Organization kind" className="input w-auto py-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">All kinds</option>
          {['Shelter', 'Food Bank', 'Pantry', 'Community Kitchen'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <select aria-label="Sort" className="input w-auto py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="urgency">Sort: most urgent</option>
          <option value="verified">Sort: recently verified</option>
          <option value="name">Sort: name</option>
        </select>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          {rows.length === 0 && <Empty title="No shelters match these filters" icon={<Search />}>Try clearing the search or switching off Emergency mode.</Empty>}
          {rows.map(({ s, u, f }) => (
            <button
              key={s.id}
              onClick={() => setFocus(s.id)}
              className={cx('card w-full p-4 text-left transition-all hover:shadow-lift', focusId === s.id && 'ring-2 ring-forest-500')}
              aria-pressed={focusId === s.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-ink-900">{s.name}</div>
                  <div className="text-xs text-ink-500">{s.kind} · {s.neighborhood} · updated {relativeDays(s.lastVerified)}</div>
                </div>
                <UrgencyBadge level={u.level} score={u.score} stale={u.stale} />
              </div>
              <div className="mt-3 space-y-2">
                {s.needs.slice(0, 3).map((n) => (
                  <div key={n.label} className="text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-700"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: CATEGORY_BY_ID[n.category].color }} />{n.label}</span>
                      <span className="text-ink-500 tabular">{fmt(n.quantityReceived)} / {fmt(n.quantityNeeded)} {n.unit}</span>
                    </div>
                    <Progress className="mt-1 h-1.5" value={n.quantityReceived} max={n.quantityNeeded} label={`${n.label} progress`} />
                  </div>
                ))}
              </div>
              {f.shortageWeek !== null && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  <TrendingDown size={12} /> Forecast: may run short in {f.shortageWeek === 1 ? 'the next week' : `${f.shortageWeek} weeks`}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <MapBase height={300} flyTo={focus?.s.location ?? null} fitTo={focus ? undefined : rows.map((r) => r.s.location)}>
              {rows.map(({ s, u }) => (
                <Marker key={s.id} position={[s.location.lat, s.location.lng]} icon={pinIcon(URGENCY_STYLE[u.level].dot, { square: true, size: 16, selected: s.id === focusId, pulse: u.level === 'Critical' })} eventHandlers={{ click: () => setFocus(s.id) }} title={s.name}>
                  <Popup>{s.name} — {u.level}</Popup>
                </Marker>
              ))}
            </MapBase>
          </div>
          {focus ? (
            <ShelterProfile s={focus.s} onVerify={() => dispatch({ type: 'verifyShelter', shelterId: focus.s.id })} activeDriveId={activeDrives[0]?.id} />
          ) : (
            <Card className="card-pad">
              <Empty title="Select a shelter" icon={<ShieldCheck />}>See full requests, why the urgency score is what it is, and a 6-week shortage forecast.</Empty>
            </Card>
          )}
        </div>
      </div>

      <UrgencyMethod />
    </div>
  );
}

function ShelterProfile({ s, onVerify, activeDriveId }: { s: Shelter; onVerify: () => void; activeDriveId?: string }) {
  const u = urgency(s);
  const f = forecastShelterNeed(s);
  const chart = f.weeks.map((w) => ({ ...w, band: w.demandLow !== undefined ? [w.demandLow, w.demandHigh] : undefined }));
  const maxFactor = 100 * Math.max(...Object.values(URGENCY_WEIGHTS));
  return (
    <Card className="card-pad animate-rise">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-forest-900">{s.name}</h2>
          <div className="text-sm text-ink-500">{s.kind} · {s.address}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <UrgencyBadge level={u.level} score={u.score} stale={u.stale} />
          <ProvenanceBadge kind={s.provenance} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-ink-700 sm:grid-cols-2">
        <div className="flex items-center gap-2"><BadgeCheck size={14} className={u.stale ? 'text-amber-600' : 'text-forest-500'} /> Verified {relativeDays(s.lastVerified)} by {s.verifiedBy}</div>
        <div className="flex items-center gap-2"><Clock size={14} className="text-forest-500" /> {s.hours}</div>
        <div className="flex items-center gap-2"><Refrigerator size={14} className="text-forest-500" /> {s.storage.refrigerated ? 'Refrigeration available' : 'Shelf-stable only'} · room for {fmt(s.storage.dryCapacityLbs)} lb</div>
        <div className="flex items-center gap-2"><Truck size={14} className="text-forest-500" /> Distributes food within ~{s.turnoverDays} days</div>
        {s.contact.public ? (
          <>
            {s.contact.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-forest-500" /> {s.contact.phone}</div>}
            {s.contact.email && <div className="flex items-center gap-2"><Mail size={14} className="text-forest-500" /> {s.contact.email}</div>}
          </>
        ) : (
          <div className="flex items-center gap-2 text-ink-400"><ShieldCheck size={14} /> Contact shared only with approved organizers</div>
        )}
      </div>

      <div className="mt-5">
        <div className="label">Requested items</div>
        <table className="w-full text-sm">
          <tbody>
            {s.needs.map((n) => {
              const left = Math.max(0, n.quantityNeeded - n.quantityReceived);
              return (
                <tr key={n.label} className="border-t border-cream-200">
                  <td className="py-2"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: CATEGORY_BY_ID[n.category].color }} />{n.label}</td>
                  <td className="py-2 text-right font-semibold tabular">{fmt(left)} {n.unit} needed</td>
                  <td className="w-24 py-2 pl-3"><Progress value={n.quantityReceived} max={n.quantityNeeded} label={`${n.label} progress`} /></td>
                  <td className="py-2 pl-2 text-right text-xs text-ink-400">{relativeDays(n.deadline)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-xl bg-cream-100 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-bold">Why this is {u.level.toLowerCase()} ({u.score}/100)</div>
          {u.stale && <span className="text-[11px] font-semibold text-amber-700">×{STALE_DISCOUNT} stale discount applied</span>}
        </div>
        <div className="space-y-2">
          {u.factors.map((x) => (
            <div key={x.key} className="text-xs">
              <div className="flex justify-between">
                <span className="font-semibold text-ink-700">{x.label} <span className="font-normal text-ink-400">(weight {Math.round(URGENCY_WEIGHTS[x.key] * 100)}%)</span></span>
                <span className="tabular text-ink-700">+{x.contribution.toFixed(0)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-cream-300">
                <div className="h-full rounded-full bg-forest-500" style={{ width: `${(x.contribution / maxFactor) * 100}%` }} />
              </div>
              <div className="mt-0.5 text-ink-500">{x.explanation}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <CardTitle
          title="6-week supply forecast"
          subtitle={`Holt's trend smoothing (α=${f.params.alpha}, β=${f.params.beta}). Demand trend ${f.trendPctPerWeek >= 0 ? '+' : ''}${f.trendPctPerWeek.toFixed(1)}%/week.`}
          right={f.trendPctPerWeek >= 0 ? <TrendingUp size={18} className="text-coral-500" /> : <TrendingDown size={18} className="text-forest-500" />}
        />
        <div className="h-56">
          <ResponsiveContainer>
            <ComposedChart data={chart.slice(-12)} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="week" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={(v) => fmt(v)} />
              <Tooltip content={<ChartTooltip />} />
              <Area dataKey="band" name="Demand range" fill="#FAD9CF" stroke="none" fillOpacity={0.7} isAnimationActive={false} />
              <Line dataKey="actual" name="Food distributed" stroke="#3B4740" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="demand" name="Forecast demand" stroke="#C24E2A" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line dataKey="inventory" name="Projected inventory" stroke="#1f8a52" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
              <ReferenceLine x="Now" stroke="#A9B0AB" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <Legend items={[{ label: 'Food distributed', color: '#3B4740' }, { label: 'Forecast demand', color: '#C24E2A', dashed: true }, { label: 'Projected inventory', color: '#1f8a52' }]} />
        {f.shortageWeek !== null ? (
          <p className="mt-2 text-xs font-semibold text-amber-700">Inventory projected to drop below half a week of demand in week {f.shortageWeek}, about {fmt(f.projectedGapLbs)} lb short at the low point.</p>
        ) : (
          <p className="mt-2 text-xs text-forest-700">No shortage projected in the next 6 weeks at current supply levels.</p>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-cream-300 p-3 text-sm">
        <div className="label">Donation instructions</div>
        {s.instructions}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {activeDriveId && <Link to={`/match?drive=${activeDriveId}`} className="btn-primary">Match a drive's food to this shelter</Link>}
        <button className="btn-secondary" onClick={onVerify}><BadgeCheck size={15} /> Staff: re-verify request</button>
      </div>
    </Card>
  );
}

function UrgencyMethod() {
  const levels: [UrgencyLevel, string][] = [['Critical', '75+'], ['High', '55–74'], ['Moderate', '35–54'], ['Low', '<35']];
  return (
    <section id="urgency" className="mt-10 scroll-mt-24">
      <Card className="card-pad">
        <CardTitle title="How urgency is calculated" subtitle="Published, fixed weights. No hidden AI judgment." icon={<ShieldCheck size={18} />} />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="text-sm leading-relaxed text-ink-700">
            <p className="rounded-xl bg-cream-100 p-3 font-mono text-xs">
              score = 100 × ( 0.35·severity + 0.25·deadline + 0.20·unmet + 0.20·low-inventory )
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-ink-500">
              <li><strong className="text-ink-700">Severity</strong>: shortage level reported by staff, 1–5, scaled to 0–1.</li>
              <li><strong className="text-ink-700">Deadline</strong>: 1 when a request is due today, falling to 0 at 30+ days.</li>
              <li><strong className="text-ink-700">Unmet</strong>: share of requested pounds not yet received.</li>
              <li><strong className="text-ink-700">Low inventory</strong>: 1 at zero days of food on hand, 0 at 21+ days.</li>
              <li>Requests not re-verified within {STALE_AFTER_DAYS} days are flagged and multiplied by {STALE_DISCOUNT}.</li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-2 self-start">
            {levels.map(([l, r]) => (
              <div key={l} className={cx('rounded-xl border p-3', URGENCY_STYLE[l].bg)}>
                <UrgencyBadge level={l} />
                <div className="mt-1 text-xs text-ink-500">Score {r}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}

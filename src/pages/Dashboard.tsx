import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CalendarClock, HandHeart, Plus, Scale, Timer, TrendingDown, Truck, UtensilsCrossed } from 'lucide-react';
import { useStore } from '../state/store';
import { useEmergency } from '../components/Layout';
import { forecast } from '../lib/forecast';
import { urgency } from '../lib/urgency';
import { forecastShelterNeed } from '../lib/needForecast';
import { wasteAlerts } from '../lib/waste';
import { LBS_PER_MEAL, CATEGORY_BY_ID } from '../lib/categories';
import { daysFromToday, formatDate, monthOf, relativeDays } from '../lib/dates';
import { AXIS, Card, CardTitle, ChartTooltip, GRID, PageHeader, Progress, ProvenanceBadge, Stat, UrgencyBadge, fmt, fmtK } from '../components/ui';
import { STATUS_COLOR } from '../components/MapBase';

export function Dashboard() {
  const { drives, shelters, model, user } = useStore();
  const emergency = useEmergency();
  const active = drives.filter((d) => d.status === 'active');
  const upcoming = drives.filter((d) => d.status === 'upcoming').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const completed = drives.filter((d) => d.status === 'completed');

  const upcomingFc = upcoming.map((d) => ({
    d,
    fc: forecast(model, { orgType: d.orgType, organization: d.organization, participants: d.expectedParticipants, durationDays: d.durationDays, month: monthOf(d.startDate), categories: d.acceptedCategories, location: d.location }),
  }));
  const predictedUpcoming = upcomingFc.reduce((a, x) => a + x.fc.median, 0);
  const scored = shelters.map((s) => ({ s, u: urgency(s), f: forecastShelterNeed(s) }));
  const urgent = scored
    .filter(({ u }) => !emergency.on || ((u.level === 'Critical' || u.level === 'High') && u.daysSinceVerified <= 3))
    .sort((a, b) => b.u.score - a.u.score)
    .slice(0, 4);
  const openNeed = scored.reduce((a, x) => a + x.u.unmetLbs, 0);
  const shortages = scored.filter((x) => x.f.shortageWeek !== null).sort((a, b) => a.f.shortageWeek! - b.f.shortageWeek!);
  const alerts = wasteAlerts(drives, shelters);

  // Last 12 months of collection, by month.
  const now = new Date();
  const trend = Array.from({ length: 12 }, (_, i) => {
    const dt = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const lbs = completed.filter((d) => d.startDate.startsWith(key)).reduce((a, d) => a + (d.collectedLbs ?? 0), 0);
    return { month: dt.toLocaleDateString('en-US', { month: 'short' }), lbs };
  });
  const yearLbs = trend.reduce((a, t) => a + t.lbs, 0);

  return (
    <div>
      <PageHeader
        eyebrow={`Welcome back, ${user.name.split(' ')[0]}`}
        title="Community dashboard"
        subtitle="What's being collected, what's coming, and where food is needed most this week."
        actions={
          <>
            <Link to="/predict" className="btn-secondary">Run a forecast</Link>
            <Link to="/create" className="btn-primary"><Plus size={16} /> New drive</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat accent label="Active drives" value={active.length} sub={`${fmt(active.reduce((a, d) => a + (d.collectedLbs ?? 0), 0))} lb collected so far`} icon={<Scale size={18} />} />
        <Stat label="Predicted, upcoming" value={`${fmtK(predictedUpcoming)} lb`} sub={`across ${upcoming.length} scheduled drives`} icon={<CalendarClock size={18} />} badge={<ProvenanceBadge kind="estimated" />} />
        <Stat label="Open shelter need" value={`${fmtK(openNeed)} lb`} sub={`${scored.filter((x) => x.u.level === 'Critical').length} critical requests`} icon={<HandHeart size={18} />} badge={<ProvenanceBadge kind="sample" />} />
        <Stat label="Meals, past 12 months" value={fmtK(yearLbs / LBS_PER_MEAL)} sub={`from ${fmt(yearLbs)} lb`} icon={<UtensilsCrossed size={18} />} badge={<ProvenanceBadge kind="sample" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="card-pad">
            <CardTitle title="Active drives" right={<Link to="/map" className="text-xs font-semibold text-forest-700 hover:underline">View on map →</Link>} />
            <div className="space-y-4">
              {active.map((d) => {
                const elapsed = Math.min(d.durationDays, Math.max(1, -daysFromToday(d.startDate) + 1));
                const pace = Math.round(((d.collectedLbs ?? 0) / elapsed) * d.durationDays);
                return (
                  <Link key={d.id} to={`/drives/${d.id}`} className="block rounded-2xl border border-cream-300 p-4 transition-shadow hover:shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 font-bold"><span className="h-2 w-2 animate-pulse rounded-full" style={{ background: STATUS_COLOR.active }} />{d.name}</div>
                        <div className="text-xs text-ink-500">{d.organization} · day {elapsed} of {d.durationDays}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-xl font-semibold text-forest-900 tabular">{fmt(d.collectedLbs ?? 0)} <span className="text-sm text-ink-400">/ {fmt(d.goalLbs)} lb</span></div>
                        <div className={pace >= d.goalLbs ? 'text-xs font-semibold text-forest-600' : 'text-xs font-semibold text-amber-700'}>On pace for {fmt(pace)} lb</div>
                      </div>
                    </div>
                    <Progress className="mt-3" value={d.collectedLbs ?? 0} max={d.goalLbs} label={`${d.name} progress`} />
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="card-pad">
            <CardTitle title="Upcoming drives: predicted needs" subtitle="Forecast range and the volunteers each will need" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="text-left text-xs text-ink-400"><th className="pb-2 font-semibold">Drive</th><th className="pb-2 font-semibold">Starts</th><th className="pb-2 text-right font-semibold">Forecast (80%)</th><th className="pb-2 text-right font-semibold">Goal</th><th className="pb-2 text-right font-semibold">Open shifts</th></tr></thead>
                <tbody>
                  {upcomingFc.map(({ d, fc }) => (
                    <tr key={d.id} className="border-t border-cream-200">
                      <td className="py-2.5"><Link to={`/drives/${d.id}`} className="font-semibold hover:text-forest-700">{d.name}</Link></td>
                      <td className="py-2.5 text-ink-500">{relativeDays(d.startDate)}</td>
                      <td className="py-2.5 text-right tabular">{fmt(fc.low)}–{fmt(fc.high)} lb</td>
                      <td className={fc.median >= d.goalLbs ? 'py-2.5 text-right font-semibold text-forest-700 tabular' : 'py-2.5 text-right font-semibold text-amber-700 tabular'}>{fmt(d.goalLbs)}</td>
                      <td className="py-2.5 text-right tabular">{d.shifts.reduce((a, s) => a + s.slots - s.filled, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="card-pad">
            <CardTitle title="Pounds collected, last 12 months" right={<ProvenanceBadge kind="sample" />} />
            <div className="h-48">
              <ResponsiveContainer>
                <AreaChart data={trend} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1f8a52" stopOpacity={0.35} /><stop offset="100%" stopColor="#1f8a52" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="month" {...AXIS} />
                  <YAxis {...AXIS} tickFormatter={(v) => fmtK(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area dataKey="lbs" name="Collected" stroke="#145536" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="card-pad">
            <CardTitle title={emergency.on ? 'Verified urgent requests' : 'Most urgent requests'} right={<Link to="/shelters" className="text-xs font-semibold text-forest-700 hover:underline">All →</Link>} />
            <ul className="space-y-3">
              {urgent.map(({ s, u }) => (
                <li key={s.id}>
                  <Link to={`/shelters?focus=${s.id}`} className="block rounded-xl p-2 -m-2 hover:bg-cream-100">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">{s.name}</span>
                      <UrgencyBadge level={u.level} score={u.score} />
                    </div>
                    <div className="mt-0.5 text-xs text-ink-500">{fmt(u.unmetLbs)} lb still needed · verified {relativeDays(s.lastVerified)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="card-pad">
            <CardTitle title="Shortage forecast" subtitle="Shelters projected to run low in the next 6 weeks" icon={<TrendingDown size={18} className="text-amber-600" />} />
            <ul className="space-y-2 text-sm">
              {shortages.slice(0, 5).map(({ s, f }) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <Link to={`/shelters?focus=${s.id}`} className="truncate hover:text-forest-700">{s.name}</Link>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{f.shortageWeek === 1 ? 'this week' : `week ${f.shortageWeek}`}</span>
                </li>
              ))}
            </ul>
          </Card>

          {alerts.length > 0 && (
            <Card className="card-pad">
              <CardTitle title="Expiring soon" subtitle="Route these first to avoid waste" icon={<Timer size={18} className="text-coral-600" />} />
              <ul className="space-y-2.5 text-sm">
                {alerts.slice(0, 4).map((a) => (
                  <li key={a.lot.id}>
                    <div className="font-semibold">{fmt(a.lot.lbs)} lb {CATEGORY_BY_ID[a.lot.category].short.toLowerCase()} <span className={a.daysLeft <= 5 ? 'text-coral-600' : 'text-amber-700'}>· {a.daysLeft} days left</span></div>
                    <div className="text-xs text-ink-500">at {a.drive.name}{a.recipients[0] ? ` → suggest ${a.recipients[0].shelter.name}` : ''}</div>
                  </li>
                ))}
              </ul>
              <Link to={`/match?drive=${alerts[0].drive.id}`} className="btn-secondary mt-4 w-full"><Truck size={15} /> Plan deliveries</Link>
            </Card>
          )}

          <Card className="card-pad bg-forest-50">
            <div className="text-sm font-bold text-forest-900">Your next shift</div>
            {(() => {
              const shift = drives.flatMap((d) => d.shifts.map((s) => ({ d, s }))).filter((x) => user.signedUpShiftIds.includes(x.s.id)).sort((a, b) => a.s.date.localeCompare(b.s.date))[0];
              return shift ? (
                <Link to={`/drives/${shift.d.id}`} className="mt-1 block text-sm text-forest-800 hover:underline">
                  {shift.s.role} at {shift.d.name}, {formatDate(shift.s.date, { weekday: 'short', month: 'short', day: 'numeric' })} {shift.s.start}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-forest-800">No shifts yet.</p>
              );
            })()}
            <Link to="/volunteer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-forest-700">Find more shifts <ArrowRight size={14} /></Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

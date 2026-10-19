import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Car, Clock, Container, Package, Users, UtensilsCrossed } from 'lucide-react';
import type { Forecast } from '../lib/forecast';
import type { ResourcePlan } from '../lib/resources';
import { ASSUMPTIONS } from '../lib/resources';
import { AXIS, ChartTooltip, cx, fmt } from './ui';

/** Horizontal range: 80% interval with the median marked, optional goal/actual ticks. */
export function RangeBar({ fc, goal, actual, actualLabel = 'Actual', scaleMax }: { fc: Forecast; goal?: number; actual?: number; actualLabel?: string; scaleMax?: number }) {
  const max = scaleMax ?? Math.max(fc.high, goal ?? 0, actual ?? 0) * 1.12;
  const pos = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="relative mt-8 h-10" aria-hidden>
      <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-cream-200" />
      <div className="absolute top-3 h-4 rounded-full bg-forest-200 transition-all duration-500" style={{ left: pos(fc.low), width: `calc(${pos(fc.high)} - ${pos(fc.low)})` }} />
      <div className="absolute top-1.5 h-7 w-1 -translate-x-1/2 rounded-full bg-forest-800 transition-all duration-500" style={{ left: pos(fc.median) }} />
      <div className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-forest-800 transition-all duration-500" style={{ left: pos(fc.median) }}>
        Most likely {fmt(fc.median)}
      </div>
      <div className="absolute top-8 -translate-x-1/2 text-[11px] text-ink-500 tabular" style={{ left: pos(fc.low) }}>{fmt(fc.low)}</div>
      <div className="absolute top-8 -translate-x-1/2 text-[11px] text-ink-500 tabular" style={{ left: pos(fc.high) }}>{fmt(fc.high)}</div>
      {goal !== undefined && (
        <div className="absolute top-0 h-10 border-l-2 border-dashed border-amber-600" style={{ left: pos(goal) }}>
          <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-amber-50 px-1 text-[10px] font-bold text-amber-700">Goal</span>
        </div>
      )}
      {actual !== undefined && (
        <div className="absolute top-0 h-10 border-l-2 border-coral-600" style={{ left: pos(actual) }}>
          <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-coral-50 px-1 text-[10px] font-bold text-coral-700">{actualLabel}</span>
        </div>
      )}
    </div>
  );
}

/** Step-by-step multipliers: how the forecast was built. */
export function ForecastExplanation({ fc }: { fc: Forecast }) {
  return (
    <ol className="space-y-2.5">
      {fc.steps.map((s, i) => {
        const isMult = i > 0;
        const up = s.factor >= 1;
        return (
          <li key={s.label} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest-50 text-[11px] font-bold text-forest-700">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-semibold text-ink-900">{s.label}</span>
                <span className="text-sm tabular">
                  {isMult ? (
                    <span className={cx('font-bold', Math.abs(s.factor - 1) < 0.02 ? 'text-ink-400' : up ? 'text-forest-600' : 'text-coral-600')}>×{s.factor.toFixed(2)}</span>
                  ) : null}
                  <span className="ml-2 text-ink-500">→ {fmt(s.running)} lb</span>
                </span>
              </div>
              <p className="text-xs leading-relaxed text-ink-500">{s.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ResourceCards({ plan, durationDays }: { plan: ResourcePlan; durationDays: number }) {
  const veh = plan.vehicles.map((v) => `${v.count} ${v.label.toLowerCase()}${v.count > 1 ? 's' : ''}`).join(' + ');
  const cards = [
    { icon: <UtensilsCrossed size={18} />, label: 'Meals supported', value: `${fmt(plan.meals.median)}`, sub: `range ${fmt(plan.meals.low)}–${fmt(plan.meals.high)} · 1.2 lb per meal` },
    { icon: <Users size={18} />, label: 'Volunteers needed', value: fmt(plan.volunteers.total), sub: `${plan.volunteers.greeters} greeters + ${plan.volunteers.sorters} sorters per shift, ${plan.volunteers.drivers} driver${plan.volunteers.drivers > 1 ? 's' : ''}` },
    { icon: <Clock size={18} />, label: 'Volunteer hours', value: fmt(plan.volunteers.volunteerHours), sub: `over ${durationDays} day${durationDays > 1 ? 's' : ''}, ${ASSUMPTIONS.shiftHours}-hr shifts` },
    { icon: <Package size={18} />, label: 'Collection boxes', value: fmt(plan.boxes), sub: `${ASSUMPTIONS.lbsPerBox} lb each, sized for the high estimate + ${ASSUMPTIONS.bufferPct * 100}%` },
    { icon: <Container size={18} />, label: 'Storage space', value: `${fmt(plan.storageSqft)} sq ft`, sub: `${plan.pallets} pallet${plan.pallets > 1 ? 's' : ''} footprint` },
    { icon: <Car size={18} />, label: 'Vehicles', value: veh, sub: `≈ ${plan.vehicleTrips} delivery trip${plan.vehicleTrips > 1 ? 's' : ''}`, small: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-cream-300/70 bg-cream-50 p-3.5 transition-shadow hover:shadow-card">
          <div className="flex items-center gap-2 text-forest-600">
            {c.icon}
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{c.label}</span>
          </div>
          <div className={cx('mt-1.5 font-display font-semibold text-forest-900 tabular', c.small ? 'text-base leading-snug' : 'text-2xl')}>{c.value}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-ink-500">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function CategoryMix({ plan, demand }: { plan: ResourcePlan; demand?: Partial<Record<string, number>> }) {
  const data = plan.categorySplit.map((c) => ({ name: c.label, lbs: c.lbs, color: c.color, demand: Math.round(demand?.[c.category] ?? 0) }));
  return (
    <div>
      <div style={{ height: Math.max(160, data.length * 34) }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }} barCategoryGap={8}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={150} {...AXIS} tick={{ fill: '#3B4740', fontSize: 12 }} />
            <Tooltip cursor={{ fill: '#F4EFE3' }} content={<ChartTooltip />} />
            <Bar dataKey="lbs" name="Expected to collect" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#3B4740', formatter: (v: number) => fmt(v) }}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {demand && (
        <table className="mt-3 w-full text-xs">
          <caption className="sr-only">Expected collection versus nearby verified need by category</caption>
          <thead>
            <tr className="text-left text-ink-400">
              <th className="py-1 font-semibold">Category</th>
              <th className="py-1 text-right font-semibold">Expected</th>
              <th className="py-1 text-right font-semibold">Nearby need</th>
              <th className="py-1 text-right font-semibold">Suggestion</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const gap = d.demand - d.lbs;
              return (
                <tr key={d.name} className="border-t border-cream-200">
                  <td className="py-1.5 text-ink-700">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: d.color }} />
                    {d.name}
                  </td>
                  <td className="py-1.5 text-right tabular">{fmt(d.lbs)} lb</td>
                  <td className="py-1.5 text-right tabular">{d.demand ? `${fmt(d.demand)} lb` : '—'}</td>
                  <td className={cx('py-1.5 text-right font-semibold', gap > 50 ? 'text-coral-600' : gap < -100 ? 'text-ink-400' : 'text-forest-600')}>
                    {gap > 50 ? 'Ask for more' : gap < -100 ? 'Enough' : 'On target'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function DataStrength({ fc }: { fc: Forecast }) {
  const tone = fc.dataStrength.level === 'Strong' ? 'bg-forest-50 text-forest-700 border-forest-100' : fc.dataStrength.level === 'Moderate' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-coral-50 text-coral-700 border-coral-100';
  const bars = fc.dataStrength.level === 'Strong' ? 3 : fc.dataStrength.level === 'Moderate' ? 2 : 1;
  return (
    <div className={cx('flex items-start gap-3 rounded-xl border p-3 text-xs', tone)}>
      <div className="mt-0.5 flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span key={b} className={cx('w-1.5 rounded-sm', b <= bars ? 'bg-current' : 'bg-current opacity-20')} style={{ height: 4 + b * 4 }} />
        ))}
      </div>
      <div>
        <div className="font-bold">{fc.dataStrength.level} history</div>
        <div className="opacity-90">{fc.dataStrength.explanation}</div>
      </div>
    </div>
  );
}


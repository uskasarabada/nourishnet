import { useMemo, useState } from 'react';
import { Bar, BarChart, Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, Building2, Clock, HandHeart, Medal, PackageCheck, Scale, Sprout, Trophy, Truck, Users, UtensilsCrossed } from 'lucide-react';
import { useStore } from '../state/store';
import { CATEGORIES, LBS_PER_MEAL } from '../lib/categories';
import { AXIS, Callout, Card, CardTitle, ChartTooltip, GRID, Legend, PageHeader, ProvenanceBadge, Stat, cx, fmt, fmtK } from '../components/ui';
import { parseISODate } from '../lib/dates';
import type { FoodCategory } from '../lib/types';

const MILESTONES = [10000, 25000, 50000, 100000, 250000];

export function Impact() {
  const { drives, shelters } = useStore();
  const [range, setRange] = useState<'all' | '12'>('all');
  const completed = useMemo(() => {
    const cut = Date.now() - 365 * 86400000;
    return drives.filter((d) => d.status === 'completed' && (range === 'all' || parseISODate(d.startDate).getTime() >= cut)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [drives, range]);

  const totalLbs = completed.reduce((a, d) => a + (d.collectedLbs ?? 0), 0);
  const volunteerHours = completed.reduce((a, d) => a + (d.volunteerHours ?? 0), 0);
  const volunteers = completed.reduce((a, d) => a + (d.volunteers ?? 0), 0);
  const sheltersAssisted = new Set(completed.flatMap((d) => d.sheltersSupported ?? [])).size;
  const delivered = completed.filter((d) => (d.sheltersSupported ?? []).length > 0).reduce((a, d) => a + (d.collectedLbs ?? 0), 0);

  // Timeline: cumulative pounds by month.
  const timeline = useMemo(() => {
    const byMonth = new Map<string, { lbs: number; drives: number }>();
    for (const d of completed) {
      const k = d.startDate.slice(0, 7);
      const v = byMonth.get(k) ?? { lbs: 0, drives: 0 };
      v.lbs += d.collectedLbs ?? 0;
      v.drives += 1;
      byMonth.set(k, v);
    }
    if (!completed.length) return [];
    const start = parseISODate(completed[0].startDate);
    const end = new Date();
    const out: { month: string; lbs: number; cumulative: number; meals: number; drives: number }[] = [];
    let cum = 0;
    for (let dt = new Date(start.getFullYear(), start.getMonth(), 1); dt <= end; dt.setMonth(dt.getMonth() + 1)) {
      const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const v = byMonth.get(k) ?? { lbs: 0, drives: 0 };
      cum += v.lbs;
      out.push({ month: dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), lbs: v.lbs, cumulative: cum, meals: Math.round(cum / LBS_PER_MEAL), drives: v.drives });
    }
    return out;
  }, [completed]);

  // Category mix per year.
  const byYear = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const d of completed) {
      const y = d.startDate.slice(0, 4);
      const row = m.get(y) ?? { year: Number(y) };
      for (const [c, v] of Object.entries(d.collectedByCategory ?? {})) row[c] = (row[c] ?? 0) + (v ?? 0);
      m.set(y, row);
    }
    return [...m.values()].sort((a, b) => a.year - b.year);
  }, [completed]);
  const usedCats = CATEGORIES.filter((c) => byYear.some((r) => (r[c.id] ?? 0) > 0));

  // Fair challenge: normalize by participants so a 120-student school can beat a 900-student one.
  const leaderboard = useMemo(() => {
    const m = new Map<string, { org: string; lbs: number; participants: number; drives: number; type: string }>();
    for (const d of completed) {
      if (d.orgType !== 'school' && d.orgType !== 'student_group') continue;
      const v = m.get(d.organization) ?? { org: d.organization, lbs: 0, participants: 0, drives: 0, type: d.orgType };
      v.lbs += d.collectedLbs ?? 0;
      v.participants += d.actualParticipants ?? d.expectedParticipants;
      v.drives += 1;
      m.set(d.organization, v);
    }
    return [...m.values()].map((v) => ({ ...v, perPerson: v.lbs / v.participants })).sort((a, b) => b.perPerson - a.perPerson);
  }, [completed]);

  const nextMilestone = MILESTONES.find((m) => m > totalLbs) ?? MILESTONES[MILESTONES.length - 1];
  const reached = MILESTONES.filter((m) => m <= totalLbs);

  return (
    <div>
      <PageHeader
        eyebrow="Impact Analytics"
        title="What our community has done together"
        subtitle="Measured results from completed drives. Weighed pounds are measurements; meals are an estimate (1.2 lb ≈ 1 meal). Every figure is labeled."
        actions={
          <div className="flex rounded-full border border-cream-300 bg-white p-1" role="group" aria-label="Time range">
            {(['all', '12'] as const).map((r) => (
              <button key={r} aria-pressed={range === r} onClick={() => setRange(r)} className={cx('rounded-full px-3 py-1 text-xs font-semibold', range === r ? 'bg-forest-700 text-white' : 'text-ink-700')}>
                {r === 'all' ? 'All time' : 'Past 12 months'}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4">
        <Callout title="About these numbers">
          This prototype runs on <strong>fictional sample data</strong>, so nothing below is real-world impact. In production, only drives whose deliveries are confirmed by the receiving shelter would count as <em>Verified</em>; everything else stays labeled as self-reported or estimated.
        </Callout>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat accent label="Food donated" value={`${fmtK(totalLbs)} lb`} sub="weighed at collection" icon={<Scale size={18} />} />
        <Stat label="Meals supported" value={fmtK(totalLbs / LBS_PER_MEAL)} sub="1.2 lb per meal" icon={<UtensilsCrossed size={18} />} badge={<ProvenanceBadge kind="estimated" />} />
        <Stat label="Completed drives" value={completed.length} icon={<PackageCheck size={18} />} badge={<ProvenanceBadge kind="sample" />} />
        <Stat label="Shelters assisted" value={sheltersAssisted} sub={`of ${shelters.length} partners`} icon={<Building2 size={18} />} badge={<ProvenanceBadge kind="sample" />} />
        <Stat label="Volunteer hours" value={fmtK(volunteerHours)} icon={<Clock size={18} />} badge={<ProvenanceBadge kind="sample" />} />
        <Stat label="Volunteer sign-ins" value={fmtK(volunteers)} sub="people may serve at several drives" icon={<Users size={18} />} badge={<ProvenanceBadge kind="sample" />} />
        <Stat label="Food delivered" value={`${fmtK(delivered)} lb`} sub="handed off to a partner" icon={<Truck size={18} />} badge={<ProvenanceBadge kind="self-reported" />} />
        <Stat label="Avg. per drive" value={`${fmt(totalLbs / Math.max(1, completed.length))} lb`} icon={<HandHeart size={18} />} badge={<ProvenanceBadge kind="sample" />} />
      </div>

      <Card className="card-pad mt-6">
        <CardTitle title="Impact over time" subtitle="Cumulative pounds collected. Drag the handles below the chart to zoom into a period." right={<ProvenanceBadge kind="sample" />} />
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={timeline} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="month" {...AXIS} minTickGap={24} />
              <YAxis {...AXIS} tickFormatter={(v) => fmtK(v)} />
              <Tooltip content={<ChartTooltip />} />
              <Line dataKey="cumulative" name="Total collected" stroke="#145536" strokeWidth={2.5} dot={false} />
              <Brush dataKey="month" height={24} stroke="#74B892" fill="#FBF8F1" travellerWidth={10} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="card-pad">
          <CardTitle title="Pounds by month" subtitle="Seasonality is visible: giving peaks around the holidays." />
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={timeline} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" {...AXIS} minTickGap={24} />
                <YAxis {...AXIS} tickFormatter={(v) => fmtK(v)} />
                <Tooltip cursor={{ fill: '#F4EFE3' }} content={<ChartTooltip />} />
                <Bar dataKey="lbs" name="Collected" fill="#1f8a52" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="card-pad">
          <CardTitle title="What was donated, by year" />
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={byYear} margin={{ top: 8, right: 4, left: -10, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid {...GRID} />
                <XAxis dataKey="year" {...AXIS} />
                <YAxis {...AXIS} tickFormatter={(v) => fmtK(v)} />
                <Tooltip cursor={{ fill: '#F4EFE3' }} content={<ChartTooltip />} />
                {usedCats.map((c, i) => (
                  <Bar key={c.id} dataKey={c.id as FoodCategory} name={c.short} stackId="y" fill={c.color} stroke="#fff" strokeWidth={2} radius={i === usedCats.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Legend items={usedCats.map((c) => ({ label: c.short, color: c.color }))} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card className="card-pad">
          <CardTitle title="School & club challenge" subtitle="Ranked by pounds per participant, so small schools compete on equal footing." icon={<Trophy size={18} />} />
          <ol className="space-y-2">
            {leaderboard.map((r, i) => (
              <li key={r.org} className="flex items-center gap-3 rounded-xl border border-cream-300 p-3">
                <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold', i === 0 ? 'bg-amber-100 text-amber-700' : i < 3 ? 'bg-forest-50 text-forest-700' : 'bg-cream-200 text-ink-500')}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.org}</div>
                  <div className="text-xs text-ink-500">{r.drives} drives · {fmt(r.participants)} participants · {fmt(r.lbs)} lb total</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-semibold text-forest-900 tabular">{r.perPerson.toFixed(2)}</div>
                  <div className="text-[10px] font-semibold uppercase text-ink-400">lb / person</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-6">
          <Card className="card-pad">
            <CardTitle title="Community milestones" subtitle="Everyone's pounds count toward shared goals." icon={<Sprout size={18} />} />
            <div className="text-sm text-ink-700">Next: <strong>{fmt(nextMilestone)} lb</strong> ({Math.min(100, Math.round((totalLbs / nextMilestone) * 100))}%)</div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-cream-200">
              <div className="h-full rounded-full bg-gradient-to-r from-forest-500 to-emerald-500" style={{ width: `${Math.min(100, (totalLbs / nextMilestone) * 100)}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {MILESTONES.map((m) => (
                <span key={m} className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', reached.includes(m) ? 'bg-forest-700 text-white' : 'bg-cream-200 text-ink-400')}>
                  <Medal size={12} /> {fmtK(m)} lb
                </span>
              ))}
            </div>
          </Card>
          <Card className="card-pad">
            <CardTitle title="Badges anyone can earn" subtitle="Rewarding effort, not size" icon={<Award size={18} />} />
            <ul className="space-y-2 text-sm">
              <li><strong>Need Matcher</strong>: 80%+ of a drive's food went to requested categories</li>
              <li><strong>Zero Waste</strong>: no expired items at close-out</li>
              <li><strong>Forecast Beater</strong>: collected above your forecast range</li>
              <li><strong>Gap Filler</strong>: hosted a drive in a high coverage-gap area</li>
              <li><strong>First Drive</strong>: welcome to the network!</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

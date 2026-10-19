import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, HandHeart, MapPin, Sparkles } from 'lucide-react';
import { useStore } from '../state/store';
import { matchShifts, type VolunteerPrefs } from '../lib/volunteers';
import type { VolunteerShift } from '../lib/types';
import { Card, CardTitle, Empty, PageHeader, Slider, fmt } from '../components/ui';
import { formatDate } from '../lib/dates';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ROLES: { role: VolunteerShift['role']; desc: string }[] = [
  { role: 'Greeter', desc: 'Welcome donors, hand out receipts' },
  { role: 'Collection', desc: 'Staff bins and carry boxes' },
  { role: 'Sorting', desc: 'Check dates, sort by category' },
  { role: 'Driver', desc: 'Deliver to shelters (licensed drivers)' },
  { role: 'Setup', desc: 'Tables, signs, and bins' },
];

export function Volunteer() {
  const { drives, user, dispatch } = useStore();
  const [days, setDays] = useState<number[]>([0, 5, 6]);
  const [times, setTimes] = useState<VolunteerPrefs['times']>(['morning', 'afternoon']);
  const [roles, setRoles] = useState<VolunteerShift['role'][]>(['Sorting', 'Greeter']);
  const [maxMiles, setMaxMiles] = useState(10);

  const matches = useMemo(() => matchShifts(drives, { days, times, roles, maxMiles, home: user.home }, user.signedUpShiftIds), [drives, days, times, roles, maxMiles, user]);
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

  return (
    <div>
      <PageHeader eyebrow="Volunteer matching" title="Find a shift that fits your life" subtitle="Tell us when and how you'd like to help. We rank open shifts by availability, distance, preferred role, and where help is needed most." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="card-pad space-y-5 lg:sticky lg:top-24 lg:self-start">
          <CardTitle title="Your preferences" icon={<HandHeart size={18} />} />
          <div>
            <span className="label">Days you're free</span>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => (
                <button key={d} aria-pressed={days.includes(i)} onClick={() => setDays(toggle(days, i))} className={days.includes(i) ? 'chip-on' : 'chip-off'}>{d}</button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ink-400">Leave all off to see every day.</p>
          </div>
          <div>
            <span className="label">Time of day</span>
            <div className="flex gap-1.5">
              {(['morning', 'afternoon'] as const).map((t) => (
                <button key={t} aria-pressed={times.includes(t)} onClick={() => setTimes(toggle(times, t))} className={times.includes(t) ? 'chip-on' : 'chip-off'}>{t[0].toUpperCase() + t.slice(1)}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Roles you'd enjoy</span>
            <div className="space-y-1.5">
              {ROLES.map((r) => (
                <label key={r.role} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-cream-300 p-2.5 hover:border-forest-200">
                  <input type="checkbox" className="mt-0.5 accent-forest-600" checked={roles.includes(r.role)} onChange={() => setRoles(toggle(roles, r.role))} />
                  <span><span className="block text-sm font-semibold">{r.role}</span><span className="text-xs text-ink-500">{r.desc}</span></span>
                </label>
              ))}
            </div>
          </div>
          <Slider label="How far will you travel?" value={maxMiles} min={1} max={20} onChange={setMaxMiles} format={(v) => `${v} mi`} />
          <p className="flex items-center gap-1.5 text-xs text-ink-400"><MapPin size={12} /> Distances from your profile's home neighborhood.</p>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-ink-500"><strong className="text-ink-900">{matches.length}</strong> matching shifts</div>
            <Link to="/profile" className="text-sm font-semibold text-forest-700 hover:underline">My shifts ({user.signedUpShiftIds.length}) →</Link>
          </div>
          {matches.length === 0 && <Empty title="No shifts match yet" icon={<Sparkles />}>Try adding more days or increasing your travel distance.</Empty>}
          {matches.slice(0, 20).map((m, i) => (
            <Card key={m.shift.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {i < 3 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Top match</span>}
                    <span className="font-bold">{m.shift.role}</span>
                    <span className="text-sm text-ink-500">· {formatDate(m.shift.date, { weekday: 'short', month: 'short', day: 'numeric' })}, {m.shift.start}–{m.shift.end}</span>
                  </div>
                  <Link to={`/drives/${m.drive.id}`} className="mt-0.5 block text-sm font-semibold text-forest-700 hover:underline">{m.drive.name}</Link>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {m.reasons.map((r) => <li key={r} className="rounded-full bg-cream-200 px-2.5 py-0.5 text-[11px] text-ink-700">{r}</li>)}
                  </ul>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold text-forest-900 tabular">{fmt(m.score)}</div>
                    <div className="text-[10px] font-semibold uppercase text-ink-400">match</div>
                  </div>
                  <button className="btn-primary" onClick={() => dispatch({ type: 'toggleShift', shiftId: m.shift.id, driveId: m.drive.id })}>
                    <CheckCircle2 size={15} /> Sign up
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

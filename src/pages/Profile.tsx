import { Link } from 'react-router-dom';
import { Award, CalendarCheck, Clock, Leaf, Scale, UtensilsCrossed, X } from 'lucide-react';
import { useStore } from '../state/store';
import { LBS_PER_MEAL } from '../lib/categories';
import { daysFromToday, formatDate } from '../lib/dates';
import { Card, CardTitle, Empty, Progress, ProvenanceBadge, Stat, cx, fmt } from '../components/ui';
import { STATUS_COLOR } from '../components/MapBase';

export function Profile() {
  const { user, drives, dispatch } = useStore();
  const myShifts = drives
    .flatMap((d) => d.shifts.map((s) => ({ d, s })))
    .filter((x) => user.signedUpShiftIds.includes(x.s.id))
    .sort((a, b) => a.s.date.localeCompare(b.s.date));
  const upcomingShifts = myShifts.filter((x) => daysFromToday(x.s.date) >= 0);
  const organized = drives.filter((d) => user.organizedDriveIds.includes(d.id));
  const organizedLbs = organized.reduce((a, d) => a + (d.collectedLbs ?? 0), 0);
  const plannedHours = upcomingShifts.reduce((a, x) => a + (Number(x.s.end.slice(0, 2)) + Number(x.s.end.slice(3)) / 60 - Number(x.s.start.slice(0, 2)) - Number(x.s.start.slice(3)) / 60), 0);

  const badges = [
    { name: 'First Drive', earned: organized.length > 0, desc: 'Organized a food drive' },
    { name: 'Shift Starter', earned: user.signedUpShiftIds.length > 0, desc: 'Signed up for a volunteer shift' },
    { name: '25 Hours', earned: user.hoursLogged >= 25, desc: 'Logged 25 volunteer hours' },
    { name: 'Ton of Good', earned: organizedLbs >= 2000, desc: 'Drives you led collected 1 ton' },
    { name: '50 Hours', earned: user.hoursLogged >= 50, desc: 'Logged 50 volunteer hours' },
  ];

  return (
    <div>
      <div className="card relative mb-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-forest-800 to-forest-600" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-5 p-6 text-white sm:p-8">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-amber-100 font-display text-3xl font-semibold text-amber-700 ring-4 ring-white/30">
            {user.name.split(' ').map((p) => p[0]).join('')}
          </div>
          <div>
            <h1 className="text-3xl font-semibold">{user.name}</h1>
            <div className="text-forest-100">{user.role} · {user.school} · member since {formatDate(user.joined, { month: 'long', year: 'numeric' })}</div>
            <div className="mt-2"><ProvenanceBadge kind="sample" /></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Volunteer hours" value={user.hoursLogged} sub={`+${plannedHours.toFixed(1)} h scheduled`} icon={<Clock size={18} />} />
        <Stat label="Upcoming shifts" value={upcomingShifts.length} icon={<CalendarCheck size={18} />} />
        <Stat label="Collected by drives you led" value={`${fmt(organizedLbs)} lb`} sub={`${organized.length} drive${organized.length === 1 ? '' : 's'} organized`} icon={<Scale size={18} />} />
        <Stat label="Your personal impact" value={`≈${fmt((organizedLbs + user.lbsDonated) / LBS_PER_MEAL)} meals`} sub={`incl. ${user.lbsDonated} lb you donated`} icon={<UtensilsCrossed size={18} />} badge={<ProvenanceBadge kind="estimated" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="card-pad">
            <CardTitle title="My volunteer shifts" right={<Link to="/volunteer" className="text-xs font-semibold text-forest-700 hover:underline">Find more →</Link>} />
            {myShifts.length === 0 ? (
              <Empty title="No shifts yet"><Link to="/volunteer" className="font-semibold text-forest-700 underline">Find a shift</Link> that fits your schedule.</Empty>
            ) : (
              <ul className="space-y-2">
                {myShifts.map(({ d, s }) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-cream-300 p-3">
                    <div>
                      <div className="text-sm font-semibold">{s.role} · <Link to={`/drives/${d.id}`} className="text-forest-700 hover:underline">{d.name}</Link></div>
                      <div className="text-xs text-ink-500">{formatDate(s.date, { weekday: 'long', month: 'short', day: 'numeric' })}, {s.start}–{s.end}</div>
                    </div>
                    {daysFromToday(s.date) >= 0 && (
                      <button className="btn-ghost px-2 py-1 text-xs text-coral-700" onClick={() => dispatch({ type: 'toggleShift', shiftId: s.id, driveId: d.id })}>
                        <X size={13} /> Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="card-pad">
            <CardTitle title="Drives I organized" right={<Link to="/create" className="text-xs font-semibold text-forest-700 hover:underline">New drive →</Link>} />
            {organized.length === 0 ? (
              <Empty title="You haven't organized a drive yet" />
            ) : (
              <ul className="space-y-3">
                {organized.map((d) => (
                  <li key={d.id}>
                    <Link to={`/drives/${d.id}`} className="block rounded-xl border border-cream-300 p-3 hover:shadow-card">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[d.status] }} />{d.name}</div>
                        <span className="text-sm tabular text-ink-500">{fmt(d.collectedLbs ?? 0)} / {fmt(d.goalLbs)} lb</span>
                      </div>
                      <Progress className="mt-2" value={d.collectedLbs ?? 0} max={d.goalLbs} label={`${d.name} progress`} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="card-pad">
          <CardTitle title="Badges" icon={<Award size={18} />} />
          <ul className="space-y-2">
            {badges.map((b) => (
              <li key={b.name} className={cx('flex items-center gap-3 rounded-xl p-2.5', b.earned ? 'bg-forest-50' : 'bg-cream-100 opacity-60')}>
                <span className={cx('grid h-9 w-9 place-items-center rounded-full', b.earned ? 'bg-forest-600 text-white' : 'bg-cream-300 text-ink-400')}><Leaf size={16} /></span>
                <div>
                  <div className="text-sm font-semibold">{b.name}</div>
                  <div className="text-xs text-ink-500">{b.desc}{b.earned ? '' : ' · not yet earned'}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

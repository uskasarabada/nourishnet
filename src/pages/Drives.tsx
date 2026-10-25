import { Link, useNavigate } from 'react-router-dom';
import { Marker, Popup } from 'react-leaflet';
import { Calendar, MapPin } from 'lucide-react';
import { useStore } from '../state/store';
import { MapBase, SHELTER_COLOR, STATUS_COLOR, pinIcon } from '../components/MapBase';
import { PageHeader, Progress, ProvenanceBadge, fmt } from '../components/ui';
import { FEATURE_BY_ID } from '../components/features';
import type { DriveStatus, FoodDrive } from '../lib/types';
import { addDays, formatDate, relativeDays } from '../lib/dates';
import { DRIVE_TYPE_LABEL } from '../lib/labels';

const F = FEATURE_BY_ID.drives;
const STATUS_LABEL: Record<DriveStatus, string> = { active: 'Active now', upcoming: 'Upcoming', completed: 'Completed' };
const ORDER: Record<DriveStatus, number> = { active: 0, upcoming: 1, completed: 2 };

export function Drives() {
  const { drives, shelters } = useStore();
  const navigate = useNavigate();
  const completed = drives.filter((d) => d.status === 'completed').sort((a, b) => b.startDate.localeCompare(a.startDate));
  // Show current drives plus the two most recent finished ones; older drives are training history.
  const shown = [...drives.filter((d) => d.status !== 'completed'), ...completed.slice(0, 2)].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.startDate.localeCompare(b.startDate));
  const history = completed.length - Math.min(2, completed.length);

  return (
    <div>
      <PageHeader
        eyebrow="Track drives"
        accent={F.color}
        icon={F.icon}
        title="Food drives near you"
        subtitle="Click a drive to see its progress or log donations."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card relative overflow-hidden">
          <MapBase height={560} fitTo={[...shown.map((d) => d.location), ...shelters.map((s) => s.location)]}>
            {shelters.map((s) => (
              <Marker key={s.id} position={[s.location.lat, s.location.lng]} icon={pinIcon(SHELTER_COLOR, { square: true, size: 16 })} title={s.name}>
                <Popup>
                  <div className="font-bold">{s.name}</div>
                  <div className="text-xs text-ink-500">{s.kind}</div>
                  <Link to={`/shelters?focus=${s.id}`} className="mt-1 inline-block text-xs font-semibold">View needs →</Link>
                </Popup>
              </Marker>
            ))}
            {shown.map((d) => (
              <Marker
                key={d.id}
                position={[d.location.lat, d.location.lng]}
                icon={pinIcon(STATUS_COLOR[d.status], { size: 18, pulse: d.status === 'active' })}
                eventHandlers={{ click: () => navigate(`/drives/${d.id}`) }}
                keyboard
                title={d.name}
              />
            ))}
          </MapBase>
          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 p-3 text-[11px] shadow-card">
            {(['active', 'upcoming', 'completed'] as DriveStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-2 py-0.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} /> {STATUS_LABEL[s]} drive</div>
            ))}
            <div className="flex items-center gap-2 py-0.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SHELTER_COLOR }} /> Partner shelter</div>
          </div>
        </div>

        <div className="space-y-3">
          {shown.map((d) => <DriveCard key={d.id} d={d} />)}
          <p className="px-1 text-xs text-ink-500">
            +{history} older drives the model learns from. <ProvenanceBadge kind="sample" />
          </p>
        </div>
      </div>
    </div>
  );
}

function DriveCard({ d }: { d: FoodDrive }) {
  const collected = d.collectedLbs ?? 0;
  return (
    <Link to={`/drives/${d.id}`} className="card block p-4 transition-shadow hover:shadow-lift" style={{ borderLeft: `4px solid ${STATUS_COLOR[d.status]}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: STATUS_COLOR[d.status] }}>
            {d.status === 'upcoming' ? `Starts ${relativeDays(d.startDate)}` : STATUS_LABEL[d.status]}
          </div>
          <div className="mt-0.5 font-bold text-ink-900">{d.name}</div>
          <div className="text-xs text-ink-500">{d.organization} · {DRIVE_TYPE_LABEL[d.driveType]}</div>
        </div>
        {d.status !== 'upcoming' && (
          <div className="text-right">
            <div className="font-display text-xl font-semibold text-forest-900 tabular">{fmt(collected)}</div>
            <div className="text-[11px] text-ink-500">of {fmt(d.goalLbs)} lb</div>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-500">
        <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(d.startDate, { month: 'short', day: 'numeric' })} – {formatDate(addDays(d.startDate, d.durationDays - 1), { month: 'short', day: 'numeric' })}</span>
        <span className="flex items-center gap-1"><MapPin size={12} />{d.neighborhood}</span>
      </div>
      {d.status !== 'upcoming' && <Progress className="mt-3" value={collected} max={d.goalLbs} label={`${d.name} progress`} />}
    </Link>
  );
}


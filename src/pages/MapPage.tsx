import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Marker, Popup, Rectangle, Tooltip as LTooltip } from 'react-leaflet';
import { Calendar, Camera, Layers, MapPin, Package, Users, UtensilsCrossed, X } from 'lucide-react';
import { useStore } from '../state/store';
import { MapBase, DROPOFF_COLOR, SHELTER_COLOR, STATUS_COLOR, pinIcon } from '../components/MapBase';
import { Card, PageHeader, ProvenanceBadge, Toggle, cx, fmt } from '../components/ui';
import type { DriveStatus, DriveType, FoodDrive, LatLng } from '../lib/types';
import { NEIGHBORHOODS, REGION_CENTER } from '../data/region';
import { DROP_OFF_POINTS, IMPACT_NOTES, NEED_POINTS } from '../data/seed';
import { coverageGrid } from '../lib/coverage';
import { formatDate, parseISODate, relativeDays } from '../lib/dates';
import { LBS_PER_MEAL } from '../lib/categories';
import { ORG_LABEL } from '../lib/forecast';

export const DRIVE_TYPE_LABEL: Record<DriveType, string> = {
  canned_goods: 'Canned goods',
  holiday: 'Holiday',
  school_challenge: 'School challenge',
  mobile_pantry: 'Mobile pantry',
  fresh_food: 'Fresh food',
};
const STATUS_LABEL: Record<DriveStatus, string> = { active: 'Active now', upcoming: 'Upcoming', completed: 'Completed' };

export function MapPage() {
  const { drives, shelters, shelterById } = useStore();
  const [statuses, setStatuses] = useState<DriveStatus[]>(['active', 'upcoming', 'completed']);
  const [hood, setHood] = useState('all');
  const [type, setType] = useState<'all' | DriveType>('all');
  const [period, setPeriod] = useState<'all' | '12' | '24'>('all');
  const [showShelters, setShowShelters] = useState(true);
  const [showDropoffs, setShowDropoffs] = useState(true);
  const [showGap, setShowGap] = useState(false);
  const [selected, setSelected] = useState<FoodDrive | null>(null);
  const [fly, setFly] = useState<LatLng | null>(null);

  const filtered = useMemo(() => {
    const now = Date.now();
    return drives.filter((d) => {
      if (!statuses.includes(d.status)) return false;
      if (hood !== 'all' && d.neighborhood !== hood) return false;
      if (type !== 'all' && d.driveType !== type) return false;
      if (period !== 'all' && d.status === 'completed') {
        const months = (now - parseISODate(d.startDate).getTime()) / (30.4 * 86400000);
        if (months > Number(period)) return false;
      }
      return true;
    });
  }, [drives, statuses, hood, type, period]);

  const grid = useMemo(() => (showGap ? coverageGrid(REGION_CENTER, NEED_POINTS, drives) : []), [showGap, drives]);
  const counts = { active: 0, upcoming: 0, completed: 0 } as Record<DriveStatus, number>;
  filtered.forEach((d) => counts[d.status]++);

  const toggleStatus = (s: DriveStatus) => setStatuses((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]));
  const select = (d: FoodDrive) => {
    setSelected(d);
    setFly(d.location);
  };
  const list = [...filtered].sort((a, b) => (a.status === b.status ? b.startDate.localeCompare(a.startDate) : a.status === 'active' ? -1 : b.status === 'active' ? 1 : a.status === 'upcoming' ? -1 : 1));

  return (
    <div>
      <PageHeader
        eyebrow="Food Drive Map"
        title="Every drive, past, present, and planned"
        subtitle="Explore where drives have happened, what's running now, and where shelters and drop-off points are. Turn on the coverage-gap layer to find under-served neighborhoods."
      />

      {/* Filter bar */}
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Drive status">
          {(['active', 'upcoming', 'completed'] as DriveStatus[]).map((s) => (
            <button key={s} aria-pressed={statuses.includes(s)} onClick={() => toggleStatus(s)} className={statuses.includes(s) ? 'chip-on' : 'chip-off'}>
              <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: STATUS_COLOR[s] }} />
              {STATUS_LABEL[s]} <span className="opacity-70 tabular">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="mx-1 hidden h-6 w-px bg-cream-300 md:block" />
        <select aria-label="Neighborhood" className="input w-auto py-1.5 text-xs" value={hood} onChange={(e) => setHood(e.target.value)}>
          <option value="all">All neighborhoods</option>
          {NEIGHBORHOODS.map((n) => (
            <option key={n.name}>{n.name}</option>
          ))}
        </select>
        <select aria-label="Drive type" className="input w-auto py-1.5 text-xs" value={type} onChange={(e) => setType(e.target.value as 'all' | DriveType)}>
          <option value="all">All drive types</option>
          {Object.entries(DRIVE_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select aria-label="Date range for completed drives" className="input w-auto py-1.5 text-xs" value={period} onChange={(e) => setPeriod(e.target.value as 'all' | '12' | '24')}>
          <option value="all">Any date</option>
          <option value="12">Past 12 months</option>
          <option value="24">Past 24 months</option>
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <Toggle on={showShelters} onChange={setShowShelters} label="Shelters" />
          <Toggle on={showDropoffs} onChange={setShowDropoffs} label="Drop-off bins" />
          <Toggle on={showGap} onChange={setShowGap} label="Coverage gaps" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="card relative overflow-hidden">
          <MapBase height={620} flyTo={fly}>
            {grid.map((c, i) =>
              c.gap > 0.12 ? (
                <Rectangle key={i} bounds={c.bounds} pathOptions={{ stroke: false, fillColor: '#E0663F', fillOpacity: Math.min(0.55, c.gap * 0.75) }}>
                  <LTooltip>
                    Need {Math.round(c.need * 100)} · Coverage {Math.round(c.coverage * 100)} · <strong>Gap {Math.round(c.gap * 100)}</strong>
                  </LTooltip>
                </Rectangle>
              ) : null,
            )}
            {showShelters &&
              shelters.map((s) => (
                <Marker key={s.id} position={[s.location.lat, s.location.lng]} icon={pinIcon(SHELTER_COLOR, { square: true, size: 15 })}>
                  <Popup>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs text-ink-500">{s.kind} · {s.hours}</div>
                    <Link to={`/shelters?focus=${s.id}`} className="mt-1 inline-block text-xs font-semibold text-forest-700">View requests →</Link>
                  </Popup>
                </Marker>
              ))}
            {showDropoffs &&
              DROP_OFF_POINTS.map((p) => (
                <Marker key={p.id} position={[p.location.lat, p.location.lng]} icon={pinIcon(DROPOFF_COLOR, { size: 11, square: true })}>
                  <Popup>
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs text-ink-500">Year-round drop-off · {p.hours}</div>
                  </Popup>
                </Marker>
              ))}
            {filtered.map((d) => (
              <Marker
                key={d.id}
                position={[d.location.lat, d.location.lng]}
                icon={pinIcon(STATUS_COLOR[d.status], { size: d.status === 'completed' ? 12 : 17, pulse: d.status === 'active', selected: selected?.id === d.id })}
                eventHandlers={{ click: () => select(d) }}
                keyboard
                title={d.name}
              />
            ))}
          </MapBase>
          {/* Legend */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 p-3 text-[11px] shadow-card">
            <div className="mb-1.5 flex items-center gap-1 font-bold text-ink-700"><Layers size={12} /> Legend</div>
            {(['active', 'upcoming', 'completed'] as DriveStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-2 py-0.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} /> {STATUS_LABEL[s]} drive</div>
            ))}
            <div className="flex items-center gap-2 py-0.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SHELTER_COLOR }} /> Shelter / food bank</div>
            <div className="flex items-center gap-2 py-0.5"><span className="h-2 w-2 rounded-sm" style={{ background: DROPOFF_COLOR }} /> Drop-off bin</div>
            {showGap && <div className="flex items-center gap-2 py-0.5"><span className="h-2.5 w-4 rounded-sm bg-coral-500/50" /> Need exceeds coverage</div>}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {selected ? (
            <DrivePanel d={selected} onClose={() => setSelected(null)} shelterName={(id) => shelterById(id)?.name ?? id} />
          ) : (
            <Card className="card-pad">
              <div className="flex items-center justify-between">
                <div className="font-bold">{filtered.length} drives shown</div>
                <ProvenanceBadge kind="sample" />
              </div>
              <p className="mt-1 text-xs text-ink-500">Select a marker or a drive below for details.</p>
              <ul className="-mx-2 mt-3 max-h-[520px] space-y-1 overflow-y-auto pr-1">
                {list.map((d) => (
                  <li key={d.id}>
                    <button onClick={() => select(d)} className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-cream-100">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[d.status] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{d.name}</span>
                        <span className="block text-xs text-ink-500">
                          {formatDate(d.startDate)} · {d.neighborhood}
                          {d.collectedLbs ? ` · ${fmt(d.collectedLbs)} lb` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {showGap && (
            <Card className="card-pad text-xs text-ink-500">
              <div className="mb-1 font-bold text-ink-900">About the coverage-gap layer</div>
              Shaded cells show where a <em>community need index</em> is high relative to pounds collected by drives in the past 24 months (Gaussian kernel, 2-mile bandwidth).
              The need index here is <strong>synthetic</strong>; a real deployment would use public data such as the USDA Food Access Research Atlas or Feeding America's Map the Meal Gap.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DrivePanel({ d, onClose, shelterName }: { d: FoodDrive; onClose: () => void; shelterName: (id: string) => string }) {
  const meals = d.collectedLbs ? Math.round(d.collectedLbs / LBS_PER_MEAL) : 0;
  return (
    <Card className="card-pad animate-rise">
      <div className="flex items-start justify-between gap-2">
        <span className={cx('rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white')} style={{ background: STATUS_COLOR[d.status] }}>
          {STATUS_LABEL[d.status]}
        </span>
        <button onClick={onClose} aria-label="Close details" className="rounded-full p-1 text-ink-400 hover:bg-cream-200">
          <X size={16} />
        </button>
      </div>
      <h2 className="mt-3 font-display text-xl font-semibold text-forest-900">{d.name}</h2>
      <div className="mt-1 text-sm text-ink-500">{d.organization} · {ORG_LABEL[d.orgType]}</div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2"><Calendar size={15} className="text-forest-500" /> {formatDate(d.startDate)} · {d.durationDays} day{d.durationDays > 1 ? 's' : ''} <span className="text-ink-400">({relativeDays(d.startDate)})</span></div>
        <div className="flex items-center gap-2"><MapPin size={15} className="text-forest-500" /> {d.address}</div>
        <div className="flex items-center gap-2"><Package size={15} className="text-forest-500" /> {DRIVE_TYPE_LABEL[d.driveType]}</div>
      </dl>
      {d.status !== 'upcoming' && (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-cream-100 p-3 text-center">
          <div>
            <div className="font-display text-xl font-semibold text-forest-900 tabular">{fmt(d.collectedLbs ?? 0)}</div>
            <div className="text-[10px] font-semibold uppercase text-ink-500">pounds</div>
          </div>
          <div>
            <div className="font-display text-xl font-semibold text-forest-900 tabular">{fmt(d.actualParticipants ?? d.expectedParticipants)}</div>
            <div className="text-[10px] font-semibold uppercase text-ink-500">participants</div>
          </div>
          <div>
            <div className="font-display text-xl font-semibold text-forest-900 tabular">{fmt(meals)}</div>
            <div className="text-[10px] font-semibold uppercase text-ink-500">meals (est.)</div>
          </div>
        </div>
      )}
      {d.sheltersSupported && d.sheltersSupported.length > 0 && (
        <div className="mt-4">
          <div className="label">Shelters supported</div>
          <ul className="space-y-1 text-sm">
            {d.sheltersSupported.map((id) => (
              <li key={id} className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: SHELTER_COLOR }} /> {shelterName(id)}</li>
            ))}
          </ul>
        </div>
      )}
      {d.status === 'completed' && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="label">Community impact</div>
          <p className="flex gap-2 text-ink-700"><UtensilsCrossed size={15} className="mt-0.5 shrink-0 text-forest-500" /> About {fmt(meals)} meals for {d.sheltersSupported?.length ?? 0} partner organizations.</p>
          <p className="flex gap-2 text-ink-700"><Users size={15} className="mt-0.5 shrink-0 text-forest-500" /> {d.volunteers} volunteers gave {d.volunteerHours} hours.</p>
          {IMPACT_NOTES[d.id] && <p className="rounded-lg bg-forest-50 p-2 text-xs text-forest-800">“{IMPACT_NOTES[d.id]}”</p>}
        </div>
      )}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-cream-300 p-3 text-xs text-ink-400">
        <Camera size={15} /> No photos uploaded. Organizers can add photos after the event.
      </div>
      <div className="mt-3"><ProvenanceBadge kind={d.provenance} /></div>
      <Link to={`/drives/${d.id}`} className="btn-primary mt-4 w-full">Open drive page</Link>
    </Card>
  );
}

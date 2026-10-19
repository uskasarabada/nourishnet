import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import { ORG_LABEL, ORG_TYPES, forecast, probabilityOfGoal } from '../lib/forecast';
import { planResources } from '../lib/resources';
import { CATEGORIES } from '../lib/categories';
import type { DriveType, FoodCategory, FoodDrive, OrgType, VolunteerShift } from '../lib/types';
import { NEIGHBORHOODS, neighborhoodCenter } from '../data/region';
import { addDays, monthOf, todayISO } from '../lib/dates';
import { Card, CardTitle, PageHeader, ProvenanceBadge, Slider, cx, fmt } from '../components/ui';
import { DataStrength, RangeBar } from '../components/forecastViews';
import { DRIVE_TYPE_LABEL } from './MapPage';

const STEPS = ['Basics', 'Where & when', 'Goals & food', 'Volunteers', 'Review'];
const ROLES: VolunteerShift['role'][] = ['Setup', 'Collection', 'Greeter', 'Sorting', 'Driver'];

interface Prefill {
  orgType?: OrgType;
  organization?: string;
  hood?: string;
  participants?: number;
  days?: number;
  cats?: FoodCategory[];
  goal?: number;
}

export function CreateDrive() {
  const { model, categoryShares, dispatch, user } = useStore();
  const navigate = useNavigate();
  const prefill = ((useLocation().state as { prefill?: Prefill } | null)?.prefill ?? {}) as Prefill;

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState(prefill.organization || user.school);
  const [orgType, setOrgType] = useState<OrgType>(prefill.orgType ?? 'school');
  const [driveType, setDriveType] = useState<DriveType>('canned_goods');
  const [description, setDescription] = useState('');
  const [hood, setHood] = useState(prefill.hood ?? 'Maple Heights');
  const [address, setAddress] = useState('');
  const [startDate, setStartDate] = useState(addDays(todayISO(), 14));
  const [days, setDays] = useState(prefill.days ?? 5);
  const [participants, setParticipants] = useState(prefill.participants ?? 400);
  const [cats, setCats] = useState<FoodCategory[]>(prefill.cats ?? ['grains', 'protein', 'canned_veg', 'canned_fruit', 'breakfast']);
  const [goal, setGoal] = useState<number | null>(prefill.goal ?? null);
  const [shifts, setShifts] = useState<Omit<VolunteerShift, 'id' | 'filled'>[] | null>(null);
  const [touched, setTouched] = useState(false);

  const fc = useMemo(
    () => forecast(model, { orgType, organization, participants, durationDays: days, month: monthOf(startDate), categories: cats, location: neighborhoodCenter(hood) }),
    [model, orgType, organization, participants, days, startDate, cats, hood],
  );
  const plan = planResources(fc, { participants, durationDays: days, categories: cats, shelterCount: 3 }, categoryShares);
  const suggestedGoal = Math.round(fc.median / 50) * 50;
  const effGoal = goal ?? suggestedGoal;

  const generatedShifts = useMemo(() => {
    const out: Omit<VolunteerShift, 'id' | 'filled'>[] = [];
    const shown = Math.min(days, 3);
    for (let d = 0; d < shown; d++) {
      const date = addDays(startDate, d === shown - 1 ? days - 1 : d);
      if (d === 0) out.push({ role: 'Setup', date, start: '08:00', end: '09:30', slots: Math.max(2, Math.ceil(plan.volunteers.greeters / 2)) });
      out.push({ role: 'Greeter', date, start: '09:30', end: '13:00', slots: plan.volunteers.greeters });
      out.push({ role: 'Sorting', date, start: '13:00', end: '16:30', slots: plan.volunteers.sorters });
      if (d === shown - 1) out.push({ role: 'Driver', date, start: '16:30', end: '18:30', slots: plan.volunteers.drivers });
    }
    return out;
  }, [days, startDate, plan.volunteers.greeters, plan.volunteers.sorters, plan.volunteers.drivers]);
  const shiftList = shifts ?? generatedShifts;

  const errors: Record<number, string | null> = {
    0: name.trim().length < 3 ? 'Give your drive a name (at least 3 characters).' : !organization.trim() ? 'Add the organizing group.' : null,
    1: !startDate ? 'Choose a start date.' : startDate < todayISO() ? 'Start date must be today or later.' : participants < 1 ? 'Enter expected participants.' : null,
    2: cats.length === 0 ? 'Select at least one food type.' : effGoal <= 0 ? 'Set a goal.' : null,
    3: shiftList.length === 0 ? 'Add at least one volunteer shift.' : null,
    4: null,
  };
  const next = () => {
    setTouched(true);
    if (errors[step]) return;
    setTouched(false);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const publish = () => {
    const id = `dr-new-${Date.now().toString(36)}`;
    const drive: FoodDrive = {
      id,
      name: name.trim(),
      organization: organization.trim(),
      orgType,
      driveType,
      status: startDate <= todayISO() ? 'active' : 'upcoming',
      location: neighborhoodCenter(hood),
      address: address.trim() || `${hood}`,
      neighborhood: hood,
      startDate,
      durationDays: days,
      expectedParticipants: participants,
      acceptedCategories: cats,
      goalLbs: effGoal,
      predictedLbs: Math.round(fc.median),
      predictedLow: Math.round(fc.low),
      predictedHigh: Math.round(fc.high),
      collectedLbs: 0,
      collectedByCategory: {},
      dailyLog: [],
      volunteers: 0,
      volunteerHours: 0,
      shifts: shiftList.map((s, i) => ({ ...s, id: `${id}-s${i}`, filled: 0 })),
      description: description.trim() || `A ${days}-day food drive organized by ${organization.trim()}.`,
      provenance: 'self-reported',
    };
    dispatch({ type: 'createDrive', drive });
    navigate(`/drives/${id}?created=1`);
  };

  const toggleCat = (c: FoodCategory) => setCats((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));
  const editShift = (i: number, patch: Partial<Omit<VolunteerShift, 'id' | 'filled'>>) => setShifts(shiftList.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div>
      <PageHeader eyebrow="New food drive" title="Create a food drive" subtitle="Four short steps. A forecast and supply plan update as you go." />

      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              aria-current={i === step ? 'step' : undefined}
              className={cx('flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors', i === step ? 'bg-forest-700 text-white' : i < step ? 'bg-forest-50 text-forest-700 hover:bg-forest-100' : 'bg-cream-200 text-ink-400')}
            >
              <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[11px]', i === step ? 'bg-white/20' : i < step ? 'bg-forest-600 text-white' : 'bg-white')}>
                {i < step ? <Check size={12} /> : i + 1}
              </span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="card-pad">
          {step === 0 && (
            <div className="space-y-4 animate-rise">
              <CardTitle title="Tell us about your drive" />
              <div>
                <label className="label" htmlFor="name">Drive name</label>
                <input id="name" className="input" placeholder="e.g. Maple Heights Winter Warm-Up Drive" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="org">Organizing group</label>
                  <input id="org" className="input" value={organization} onChange={(e) => setOrganization(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="ot">Organization type</label>
                  <select id="ot" className="input" value={orgType} onChange={(e) => setOrgType(e.target.value as OrgType)}>
                    {ORG_TYPES.map((o) => <option key={o} value={o}>{ORG_LABEL[o]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <span className="label">Drive type</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(DRIVE_TYPE_LABEL) as DriveType[]).map((t) => (
                    <button key={t} type="button" aria-pressed={driveType === t} onClick={() => setDriveType(t)} className={driveType === t ? 'chip-on' : 'chip-off'}>{DRIVE_TYPE_LABEL[t]}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="desc">Description (shown on your event page)</label>
                <textarea id="desc" rows={3} className="input" placeholder="What makes your drive special? Where should people bring food?" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 animate-rise">
              <CardTitle title="Where and when" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="hood">Neighborhood</label>
                  <select id="hood" className="input" value={hood} onChange={(e) => setHood(e.target.value)}>
                    {NEIGHBORHOODS.map((n) => <option key={n.name}>{n.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="addr">Collection site (optional)</label>
                  <input id="addr" className="input" placeholder="e.g. Main entrance, 100 School Rd" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="start">Start date</label>
                  <input id="start" type="date" className="input" min={todayISO()} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>
              <Slider label="Length of drive" value={days} min={1} max={21} onChange={setDays} format={(v) => `${v} day${v > 1 ? 's' : ''}`} />
              <Slider label="Expected participants" value={participants} min={10} max={1500} step={10} onChange={setParticipants} format={fmt} hint="Students, members, or households you expect to give. A rough number is fine." />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-rise">
              <CardTitle title="Goals and accepted food" />
              <div>
                <span className="label">Accepted food types</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CATEGORIES.map((c) => (
                    <button key={c.id} type="button" aria-pressed={cats.includes(c.id)} onClick={() => toggleCat(c.id)} className={cx('flex items-start gap-3 rounded-xl border p-3 text-left transition-colors', cats.includes(c.id) ? 'border-forest-400 bg-forest-50' : 'border-cream-300 bg-white hover:border-forest-200')}>
                      <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border', cats.includes(c.id) ? 'border-forest-600 bg-forest-600 text-white' : 'border-cream-300')}>{cats.includes(c.id) && <Check size={12} />}</span>
                      <span>
                        <span className="flex items-center gap-1.5 text-sm font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.label}</span>
                        <span className="text-xs text-ink-500">{c.example}{c.perishable ? ' · needs cold storage' : ''}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Slider label="Donation goal" value={effGoal} min={100} max={Math.max(6000, effGoal)} step={50} onChange={(v) => setGoal(v)} format={(v) => `${fmt(v)} lb`} />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-ink-500">Chance of reaching it: <strong className="text-ink-900">{Math.round(probabilityOfGoal(fc, effGoal) * 100)}%</strong></span>
                  {goal !== null && goal !== suggestedGoal && (
                    <button className="font-semibold text-forest-700 underline" onClick={() => setGoal(null)}>Use suggested goal ({fmt(suggestedGoal)} lb)</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-rise">
              <CardTitle title="Volunteer shifts" subtitle="Generated from your staffing forecast. Edit freely." right={shifts && <button className="text-xs font-semibold text-forest-700 underline" onClick={() => setShifts(null)}>Regenerate</button>} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-400">
                      <th className="pb-2 font-semibold">Role</th><th className="pb-2 font-semibold">Date</th><th className="pb-2 font-semibold">Start</th><th className="pb-2 font-semibold">End</th><th className="pb-2 font-semibold">Spots</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {shiftList.map((s, i) => (
                      <tr key={i} className="border-t border-cream-200">
                        <td className="py-1.5 pr-2">
                          <select aria-label="Role" className="input py-1.5" value={s.role} onChange={(e) => editShift(i, { role: e.target.value as VolunteerShift['role'] })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                        </td>
                        <td className="py-1.5 pr-2"><input aria-label="Date" type="date" className="input py-1.5" value={s.date} onChange={(e) => editShift(i, { date: e.target.value })} /></td>
                        <td className="py-1.5 pr-2"><input aria-label="Start time" type="time" className="input py-1.5" value={s.start} onChange={(e) => editShift(i, { start: e.target.value })} /></td>
                        <td className="py-1.5 pr-2"><input aria-label="End time" type="time" className="input py-1.5" value={s.end} onChange={(e) => editShift(i, { end: e.target.value })} /></td>
                        <td className="py-1.5 pr-2"><input aria-label="Spots" type="number" min={1} className="input w-20 py-1.5" value={s.slots} onChange={(e) => editShift(i, { slots: Math.max(1, Number(e.target.value)) })} /></td>
                        <td><button aria-label="Remove shift" className="p-1.5 text-ink-400 hover:text-coral-600" onClick={() => setShifts(shiftList.filter((_, j) => j !== i))}><Trash2 size={15} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn-secondary" onClick={() => setShifts([...shiftList, { role: 'Collection', date: startDate, start: '10:00', end: '13:00', slots: 3 }])}><Plus size={15} /> Add shift</button>
              <p className="text-xs text-ink-500">Total spots: <strong>{shiftList.reduce((a, s) => a + s.slots, 0)}</strong> (forecast suggests about {plan.volunteers.total} volunteers).</p>
            </div>
          )}

          {step === 4 && (
            <div className="animate-rise">
              <CardTitle title="Review and publish" />
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {[
                  ['Name', name],
                  ['Organized by', `${organization} (${ORG_LABEL[orgType]})`],
                  ['Type', DRIVE_TYPE_LABEL[driveType]],
                  ['Where', `${address || 'Site TBD'}, ${hood}`],
                  ['When', `${startDate}, ${days} day${days > 1 ? 's' : ''}`],
                  ['Participants', fmt(participants)],
                  ['Goal', `${fmt(effGoal)} lb`],
                  ['Food types', cats.length + ' categories'],
                  ['Volunteer spots', String(shiftList.reduce((a, s) => a + s.slots, 0))],
                  ['Forecast saved', `${fmt(fc.low)}–${fmt(fc.high)} lb`],
                ].map(([k, v]) => (
                  <div key={k} className="border-b border-cream-200 pb-2">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400">{k}</dt>
                    <dd className="font-semibold text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-ink-500">We save today's forecast with your drive. When it ends, we compare it with what you actually collected. That comparison is how the model gets better.</p>
            </div>
          )}

          {touched && errors[step] && <p role="alert" className="mt-4 text-sm font-semibold text-coral-700">{errors[step]}</p>}

          <div className="mt-8 flex items-center justify-between border-t border-cream-200 pt-5">
            <button className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft size={16} /> Back</button>
            {step < STEPS.length - 1 ? (
              <button className="btn-primary" onClick={next}>Continue <ArrowRight size={16} /></button>
            ) : (
              <button className="btn-primary" onClick={publish}><Sparkles size={16} /> Publish drive</button>
            )}
          </div>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="card-pad">
            <div className="flex items-center justify-between">
              <div className="eyebrow">Live forecast</div>
              <ProvenanceBadge kind="estimated" />
            </div>
            <div className="mt-2 font-display text-3xl font-semibold text-forest-900 tabular">{fmt(fc.low)}–{fmt(fc.high)} lb</div>
            <div className="text-xs text-ink-500">most likely {fmt(fc.median)} lb · ≈{fmt(plan.meals.median)} meals</div>
            <RangeBar fc={fc} goal={effGoal} />
            <div className="mt-8"><DataStrength fc={fc} /></div>
          </Card>
          <Card className="card-pad">
            <div className="label">Supply checklist</div>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Collection boxes</span><strong className="tabular">{plan.boxes}</strong></li>
              <li className="flex justify-between"><span>Storage space</span><strong className="tabular">{plan.storageSqft} sq ft</strong></li>
              <li className="flex justify-between"><span>Volunteers</span><strong className="tabular">{plan.volunteers.total}</strong></li>
              <li className="flex justify-between"><span>Vehicles</span><strong className="text-right">{plan.vehicles.map((v) => `${v.count}× ${v.label}`).join(', ')}</strong></li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

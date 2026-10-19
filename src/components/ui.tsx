import type { ReactNode } from 'react';
import { AlertTriangle, BadgeCheck, Beaker, Calculator, Info, ShieldAlert } from 'lucide-react';
import type { Provenance } from '../lib/types';
import type { UrgencyLevel } from '../lib/urgency';

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtK = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : fmt(n));

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between animate-rise">
      <div className="max-w-2xl">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-3xl font-semibold text-forest-900 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <As className={cx('card', className)}>{children}</As>;
}

export function CardTitle({ title, subtitle, right, icon }: { title: string; subtitle?: ReactNode; right?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon && <div className="mt-0.5 text-forest-600">{icon}</div>}
        <div>
          <h2 className="font-sans text-[15px] font-bold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

const PROV: Record<Provenance, { label: string; cls: string; icon: ReactNode; title: string }> = {
  verified: { label: 'Verified', cls: 'bg-forest-50 text-forest-700 border-forest-200', icon: <BadgeCheck size={12} />, title: 'Confirmed by the receiving organization' },
  'self-reported': { label: 'Self-reported', cls: 'bg-cream-200 text-ink-700 border-cream-300', icon: <Info size={12} />, title: 'Entered by the organizer, not yet confirmed' },
  estimated: { label: 'Estimate', cls: 'bg-amber-50 text-amber-700 border-amber-100', icon: <Calculator size={12} />, title: 'Calculated, not measured' },
  sample: { label: 'Sample data', cls: 'bg-[#F1EEFB] text-[#4B3DA8] border-[#DCD6F5]', icon: <Beaker size={12} />, title: 'Fictional demonstration data' },
};

export function ProvenanceBadge({ kind, className }: { kind: Provenance; className?: string }) {
  const p = PROV[kind];
  return (
    <span title={p.title} className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', p.cls, className)}>
      {p.icon}
      {p.label}
    </span>
  );
}

export const URGENCY_STYLE: Record<UrgencyLevel, { bg: string; text: string; dot: string; bar: string }> = {
  Critical: { bg: 'bg-coral-50 border-coral-100', text: 'text-coral-700', dot: '#C24E2A', bar: 'bg-coral-500' },
  High: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-700', dot: '#B57F05', bar: 'bg-amber-500' },
  Moderate: { bg: 'bg-forest-50 border-forest-100', text: 'text-forest-700', dot: '#3F9A6B', bar: 'bg-forest-400' },
  Low: { bg: 'bg-cream-200 border-cream-300', text: 'text-ink-500', dot: '#7D8781', bar: 'bg-ink-300' },
};

export function UrgencyBadge({ level, score, stale }: { level: UrgencyLevel; score?: number; stale?: boolean }) {
  const s = URGENCY_STYLE[level];
  const Icon = level === 'Critical' ? ShieldAlert : level === 'High' ? AlertTriangle : Info;
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold', s.bg, s.text)}>
      <Icon size={12} aria-hidden />
      {level}
      {score !== undefined && <span className="font-semibold opacity-80 tabular">· {score}</span>}
      {stale && <span className="font-semibold">· needs re-check</span>}
    </span>
  );
}

export function Progress({ value, max, className, tone = 'forest', label }: { value: number; max: number; className?: string; tone?: 'forest' | 'amber' | 'coral'; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = tone === 'forest' ? 'bg-forest-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-coral-500';
  return (
    <div
      className={cx('h-2 w-full overflow-hidden rounded-full bg-cream-200', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-700 ease-out', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, icon, badge, accent }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; badge?: ReactNode; accent?: boolean }) {
  return (
    <div className={cx('card card-pad relative overflow-hidden', accent && 'bg-forest-800 border-forest-800 text-white')}>
      <div className="flex items-start justify-between gap-2">
        <div className={cx('text-xs font-semibold uppercase tracking-wider', accent ? 'text-forest-200' : 'text-ink-500')}>{label}</div>
        {icon && <div className={accent ? 'text-forest-300' : 'text-forest-500'}>{icon}</div>}
      </div>
      <div className={cx('mt-2 font-display text-3xl font-semibold tabular', accent ? 'text-white' : 'text-forest-900')}>{value}</div>
      {sub && <div className={cx('mt-1 text-xs', accent ? 'text-forest-200' : 'text-ink-500')}>{sub}</div>}
      {badge && <div className="mt-3">{badge}</div>}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v: number) => String(v),
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  const id = `sl-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-ink-700">
          {label}
        </label>
        <span className="font-display text-lg font-semibold text-forest-800 tabular">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${((value - min) / (max - min)) * 100}%` }}
      />
      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-700">
      <span aria-hidden className={cx('relative block h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-forest-600' : 'bg-ink-200')}>
        <span className="absolute top-0.5 block h-4 w-4 rounded-full bg-white shadow transition-[left]" style={{ left: on ? 18 : 2 }} />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-cream-300 bg-cream-50 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-forest-400">{icon}</div>}
      <div className="font-semibold text-ink-700">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export function Callout({ tone = 'info', children, title, icon }: { tone?: 'info' | 'warn' | 'alert'; children: ReactNode; title?: string; icon?: ReactNode }) {
  const cls = tone === 'info' ? 'bg-forest-50 border-forest-100 text-forest-900' : tone === 'warn' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-coral-50 border-coral-100 text-coral-700';
  return (
    <div className={cx('flex gap-3 rounded-xl border p-3.5 text-sm', cls)}>
      <div className="mt-0.5 shrink-0">{icon ?? <Info size={16} />}</div>
      <div>
        {title && <div className="font-bold">{title}</div>}
        <div className="leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
}

/** Shared Recharts tooltip so every chart's hover reads the same. */
export function ChartTooltip({ active, payload, label, unit = 'lb', labelFormat }: { active?: boolean; payload?: { name?: string; value?: number | number[]; color?: string; dataKey?: string; payload?: Record<string, unknown> }[]; label?: string | number; unit?: string; labelFormat?: (l: string | number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-cream-300 bg-white/95 px-3 py-2 text-xs shadow-lift backdrop-blur">
      {label !== undefined && <div className="mb-1 font-bold text-ink-900">{labelFormat ? labelFormat(label) : label}</div>}
      {payload
        .filter((p) => p.value !== undefined && p.value !== null && p.name)
        .map((p, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="text-ink-500">{p.name}</span>
            <span className="ml-auto pl-3 font-semibold text-ink-900 tabular">
              {Array.isArray(p.value) ? `${fmt(p.value[0])}–${fmt(p.value[1])}` : fmt(p.value as number)} {unit}
            </span>
          </div>
        ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-500">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dashed ? (
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export const AXIS = { stroke: '#A9B0AB', fontSize: 11, tickLine: false, axisLine: false } as const;
export const GRID = { stroke: '#EDE7DA', strokeDasharray: '0', vertical: false } as const;

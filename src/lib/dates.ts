const DAY_MS = 86_400_000;

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysFromToday(iso: string): number {
  return Math.round((parseISODate(iso).getTime() - startOfToday().getTime()) / DAY_MS);
}

export function todayISO(): string {
  return toISODate(startOfToday());
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }): string {
  return parseISODate(iso).toLocaleDateString('en-US', opts);
}

export function relativeDays(iso: string): string {
  const n = daysFromToday(iso);
  if (n === 0) return 'today';
  if (n === -1) return 'yesterday';
  if (n === 1) return 'tomorrow';
  return n < 0 ? `${-n} days ago` : `in ${n} days`;
}

export function monthOf(iso: string): number {
  return parseISODate(iso).getMonth(); // 0–11
}

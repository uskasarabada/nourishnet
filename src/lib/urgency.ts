// Transparent urgency score (0–100). Four factors, fixed published weights.
// No black box: the UI shows each factor's contribution.

import type { Shelter } from './types';
import { daysFromToday } from './dates';

export const URGENCY_WEIGHTS = {
  severity: 0.35, // shortage severity the shelter reported (1–5)
  deadline: 0.25, // how soon the nearest open request is due
  unmet: 0.2, // share of requested pounds still missing
  inventory: 0.2, // days of food left on the shelves
};

/** Requests not re-verified within this window are flagged and discounted. */
export const STALE_AFTER_DAYS = 14;
export const STALE_DISCOUNT = 0.85;

export type UrgencyLevel = 'Critical' | 'High' | 'Moderate' | 'Low';

export interface UrgencyResult {
  score: number;
  level: UrgencyLevel;
  stale: boolean;
  daysSinceVerified: number;
  factors: { key: keyof typeof URGENCY_WEIGHTS; label: string; value: number; contribution: number; explanation: string }[];
  unmetLbs: number;
  requestedLbs: number;
  nearestDeadlineDays: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function needLbs(s: Shelter) {
  let requested = 0;
  let unmet = 0;
  for (const n of s.needs) {
    requested += n.quantityNeeded * n.lbsPerUnit;
    unmet += Math.max(0, n.quantityNeeded - n.quantityReceived) * n.lbsPerUnit;
  }
  return { requested, unmet };
}

export function urgency(s: Shelter): UrgencyResult {
  const { requested, unmet } = needLbs(s);
  const open = s.needs.filter((n) => n.quantityReceived < n.quantityNeeded);
  const nearestDeadlineDays = open.length ? Math.min(...open.map((n) => daysFromToday(n.deadline))) : 99;

  const sev = (s.reportedSeverity - 1) / 4;
  const dl = clamp01(1 - nearestDeadlineDays / 30);
  const um = requested > 0 ? unmet / requested : 0;
  const inv = clamp01(1 - s.inventoryDaysOnHand / 21);

  const W = URGENCY_WEIGHTS;
  const factors: UrgencyResult['factors'] = [
    { key: 'severity', label: 'Reported shortage', value: sev, contribution: 100 * W.severity * sev, explanation: `Severity ${s.reportedSeverity} of 5, reported by staff` },
    { key: 'deadline', label: 'Deadline', value: dl, contribution: 100 * W.deadline * dl, explanation: nearestDeadlineDays <= 0 ? 'A request is due today' : `Nearest request due in ${nearestDeadlineDays} days` },
    { key: 'unmet', label: 'Still needed', value: um, contribution: 100 * W.unmet * um, explanation: `${Math.round(um * 100)}% of requested pounds not yet received` },
    { key: 'inventory', label: 'Food on hand', value: inv, contribution: 100 * W.inventory * inv, explanation: `About ${s.inventoryDaysOnHand} days of food left` },
  ];
  const daysSinceVerified = -daysFromToday(s.lastVerified);
  const stale = daysSinceVerified > STALE_AFTER_DAYS;
  let score = factors.reduce((a, f) => a + f.contribution, 0);
  if (stale) score *= STALE_DISCOUNT;
  score = Math.round(score);
  const level: UrgencyLevel = score >= 75 ? 'Critical' : score >= 55 ? 'High' : score >= 35 ? 'Moderate' : 'Low';
  return { score, level, stale, daysSinceVerified, factors, unmetLbs: Math.round(unmet), requestedLbs: Math.round(requested), nearestDeadlineDays };
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Donation Matching
//
// Food is handed out in small chunks (10 lb). Each chunk goes to the feasible
// (shelter, category) pair with the highest *marginal score*:
//
//   score = urgency/100  ×  √(remaining need ÷ original need)  ×  1/(1 + miles/5)
//
// • urgency     — the transparent urgency score (see urgency.ts)
// • √remaining  — diminishing returns: as a request fills, its pull weakens, so
//                 food spreads across shelters instead of all going to one
// • distance    — nearer shelters are preferred (less driving, fresher food)
//
// Hard constraints (a pair is skipped if any fails):
//   within max distance · the shelter requested the category · request not yet
//   filled · shelter has storage room · perishables only to refrigerated sites ·
//   food must not expire before the shelter can distribute it (turnover days)
//
// Organizers can LOCK a shelter's total. Locked amounts are allocated first,
// then the remaining food is re-optimized across the other shelters.
// ─────────────────────────────────────────────────────────────────────────────

import type { FoodCategory, InventoryLot, LatLng, Shelter } from './types';
import { CATEGORY_BY_ID } from './categories';
import { haversineMiles } from './geo';
import { urgency } from './urgency';
import { daysFromToday } from './dates';

export const CHUNK_LBS = 10;
export const DISTANCE_SCALE_MI = 5;

export interface SupplyLine {
  category: FoodCategory;
  lbs: number;
  /** Days until the earliest expiration in this line (Infinity for shelf-stable). */
  daysToExpiry: number;
}

export interface MatchOptions {
  maxMiles: number;
  locks: Record<string, number>; // shelterId → locked total lbs
  excluded: string[]; // shelterIds the organizer removed
}

export interface Allocation {
  shelterId: string;
  shelterName: string;
  totalLbs: number;
  byCategory: Partial<Record<FoodCategory, number>>;
  miles: number;
  urgencyScore: number;
  urgencyLevel: string;
  needFilledPct: number; // of this shelter's open request (in matched categories)
  locked: boolean;
  reasons: string[];
}

export interface Exclusion {
  shelterId: string;
  shelterName: string;
  reason: string;
}

export interface MatchResult {
  allocations: Allocation[];
  exclusions: Exclusion[];
  unallocated: Partial<Record<FoodCategory, number>>;
  totalAllocated: number;
  totalSupply: number;
  warnings: string[];
}

interface Candidate {
  shelter: Shelter;
  category: FoodCategory;
  miles: number;
  urg: number;
  originalNeed: number;
  remainingNeed: number;
}

export function supplyFromLots(lots: InventoryLot[]): SupplyLine[] {
  const by: Record<string, SupplyLine> = {};
  for (const l of lots) {
    const days = l.perishable || daysFromToday(l.expiresOn) < 60 ? daysFromToday(l.expiresOn) : Infinity;
    by[l.category] ??= { category: l.category, lbs: 0, daysToExpiry: Infinity };
    by[l.category].lbs += l.lbs;
    by[l.category].daysToExpiry = Math.min(by[l.category].daysToExpiry, days);
  }
  return Object.values(by);
}

export function supplyFromTotals(byCategory: Partial<Record<FoodCategory, number>>): SupplyLine[] {
  return Object.entries(byCategory)
    .filter(([, lbs]) => (lbs ?? 0) > 0)
    .map(([c, lbs]) => ({ category: c as FoodCategory, lbs: lbs!, daysToExpiry: CATEGORY_BY_ID[c as FoodCategory].perishable ? 5 : Infinity }));
}

function feasibility(s: Shelter, line: SupplyLine, miles: number, opts: MatchOptions): string | null {
  if (miles > opts.maxMiles) return `More than ${opts.maxMiles} mi away (${miles.toFixed(1)} mi)`;
  if (CATEGORY_BY_ID[line.category].perishable && !s.storage.refrigerated) return 'No refrigeration for perishables';
  if (line.daysToExpiry !== Infinity && line.daysToExpiry - 1 < s.turnoverDays)
    return `Would expire before distribution (${s.turnoverDays}-day turnover)`;
  return null;
}

export function matchDonations(origin: LatLng, supply: SupplyLine[], shelters: Shelter[], opts: MatchOptions): MatchResult {
  const remainingSupply: Record<string, number> = Object.fromEntries(supply.map((l) => [l.category, l.lbs]));
  const lineBy = Object.fromEntries(supply.map((l) => [l.category, l]));
  const exclusions: Exclusion[] = [];
  const candidates: Candidate[] = [];
  const capacityLeft: Record<string, number> = {};
  const warnings: string[] = [];

  for (const s of shelters) {
    const miles = haversineMiles(origin, s.location);
    if (opts.excluded.includes(s.id)) {
      exclusions.push({ shelterId: s.id, shelterName: s.name, reason: 'Removed by organizer' });
      continue;
    }
    capacityLeft[s.id] = s.storage.dryCapacityLbs;
    const u = urgency(s);
    let anyRequested = false;
    const blocked: string[] = [];
    for (const need of s.needs) {
      const line = lineBy[need.category];
      if (!line) continue;
      anyRequested = true;
      const remaining = Math.max(0, need.quantityNeeded - need.quantityReceived) * need.lbsPerUnit;
      if (remaining <= 0) continue;
      const why = feasibility(s, line, miles, opts);
      if (why) {
        blocked.push(why);
        continue;
      }
      const existing = candidates.find((c) => c.shelter.id === s.id && c.category === need.category);
      if (existing) {
        existing.originalNeed += remaining;
        existing.remainingNeed += remaining;
      } else {
        candidates.push({ shelter: s, category: need.category, miles, urg: u.score, originalNeed: remaining, remainingNeed: remaining });
      }
    }
    if (!candidates.some((c) => c.shelter.id === s.id)) {
      exclusions.push({
        shelterId: s.id,
        shelterName: s.name,
        reason: !anyRequested ? 'Has not requested any of the food types available' : blocked[0] ?? 'Requests already filled',
      });
    }
  }

  const given: Record<string, Partial<Record<FoodCategory, number>>> = {};
  const give = (c: Candidate, lbs: number) => {
    given[c.shelter.id] ??= {};
    given[c.shelter.id][c.category] = (given[c.shelter.id][c.category] ?? 0) + lbs;
    c.remainingNeed -= lbs;
    remainingSupply[c.category] -= lbs;
    capacityLeft[c.shelter.id] -= lbs;
  };
  const score = (c: Candidate) =>
    (Math.max(c.urg, 5) / 100) * Math.sqrt(c.remainingNeed / c.originalNeed) * (1 / (1 + c.miles / DISTANCE_SCALE_MI));

  const runGreedy = (pool: Candidate[], stopAt?: (shelterId: string) => boolean) => {
    for (let guard = 0; guard < 100000; guard++) {
      let best: Candidate | null = null;
      let bestScore = 0;
      for (const c of pool) {
        if (c.remainingNeed <= 0 || remainingSupply[c.category] <= 0 || capacityLeft[c.shelter.id] <= 0) continue;
        if (stopAt && stopAt(c.shelter.id)) continue;
        const sc = score(c);
        if (sc > bestScore) {
          best = c;
          bestScore = sc;
        }
      }
      if (!best) return;
      const lbs = Math.min(CHUNK_LBS, best.remainingNeed, remainingSupply[best.category], capacityLeft[best.shelter.id]);
      give(best, lbs);
    }
  };

  // Phase 1: honor organizer locks.
  const lockedIds = Object.keys(opts.locks).filter((id) => candidates.some((c) => c.shelter.id === id));
  const totalGiven = (id: string) => Object.values(given[id] ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  for (const id of lockedIds) {
    const target = opts.locks[id];
    runGreedy(
      candidates.filter((c) => c.shelter.id === id),
      (sid) => totalGiven(sid) >= target - 1e-9,
    );
    // Trim overshoot from the last chunk.
    const over = totalGiven(id) - target;
    if (over > 0) {
      const cats = Object.keys(given[id]) as FoodCategory[];
      const last = cats[cats.length - 1];
      given[id][last]! -= over;
      remainingSupply[last] += over;
    }
    if (totalGiven(id) < target - 1) {
      const name = candidates.find((c) => c.shelter.id === id)!.shelter.name;
      warnings.push(`${name} could only accept ${Math.round(totalGiven(id))} lb of the ${target} lb you locked (its open requests or storage limit).`);
    }
  }
  // Phase 2: optimize the rest.
  runGreedy(candidates.filter((c) => !lockedIds.includes(c.shelter.id)));

  const allocations: Allocation[] = Object.entries(given)
    .map(([id, byCategory]) => {
      const cs = candidates.filter((c) => c.shelter.id === id);
      const s = cs[0].shelter;
      const total = Object.values(byCategory).reduce((a, b) => a + (b ?? 0), 0);
      const orig = cs.reduce((a, c) => a + c.originalNeed, 0);
      const u = urgency(s);
      const topCats = (Object.entries(byCategory) as [FoodCategory, number][])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([c]) => CATEGORY_BY_ID[c].label.toLowerCase());
      const reasons = [
        `${u.level} urgency (${u.score}/100): ${u.factors.sort((a, b) => b.contribution - a.contribution)[0].explanation.toLowerCase()}`,
        `Requested ${topCats.join(' and ')} — this fills ${Math.round((100 * total) / orig)}% of their matching request`,
        `${cs[0].miles.toFixed(1)} mi away${cs[0].miles < 3 ? ' — one of the closest partners' : ''}`,
      ];
      if (Object.keys(byCategory).some((c) => CATEGORY_BY_ID[c as FoodCategory].perishable))
        reasons.push(`Has refrigeration and distributes within ${s.turnoverDays} days, so fresh food will be used safely`);
      if (u.stale) reasons.push(`⚠ Request last verified ${u.daysSinceVerified} days ago — confirm before delivering`);
      return {
        shelterId: id,
        shelterName: s.name,
        totalLbs: Math.round(total),
        byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round(v ?? 0)])),
        miles: cs[0].miles,
        urgencyScore: u.score,
        urgencyLevel: u.level,
        needFilledPct: Math.round((100 * total) / orig),
        locked: lockedIds.includes(id),
        reasons,
      };
    })
    .filter((a) => a.totalLbs > 0)
    .sort((a, b) => b.totalLbs - a.totalLbs);

  // Shelters that were feasible but received nothing (supply ran out first).
  for (const c of candidates) {
    if (!given[c.shelter.id] && !exclusions.some((e) => e.shelterId === c.shelter.id)) {
      exclusions.push({ shelterId: c.shelter.id, shelterName: c.shelter.name, reason: 'Lower priority — supply ran out before reaching this request' });
    }
  }

  const unallocated: Partial<Record<FoodCategory, number>> = {};
  for (const [c, v] of Object.entries(remainingSupply)) if (v > 0.5) unallocated[c as FoodCategory] = Math.round(v);
  const totalSupply = supply.reduce((a, l) => a + l.lbs, 0);
  const totalAllocated = allocations.reduce((a, x) => a + x.totalLbs, 0);
  return { allocations, exclusions, unallocated, totalAllocated, totalSupply, warnings };
}

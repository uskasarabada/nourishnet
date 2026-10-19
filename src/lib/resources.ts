// Converts a pounds forecast into a logistics plan. Every constant here is a
// planning assumption the organizer can see in the UI — not a hidden "AI" output.

import type { FoodCategory, FoodDrive, Shelter } from './types';
import { CATEGORIES, CATEGORY_BY_ID, LBS_PER_MEAL } from './categories';
import type { Forecast } from './forecast';
import { haversineMiles } from './geo';

export const ASSUMPTIONS = {
  lbsPerBox: 25, // a full banker's box of canned goods
  boxesPerPallet: 40,
  sqftPerPallet: 20, // 40"×48" pallet plus aisle space
  donorsPerGreeterHour: 20,
  lbsSortedPerVolunteerHour: 120,
  collectionHoursPerDay: 6,
  shiftHours: 3.5,
  bufferPct: 0.15, // extra boxes for odd shapes and breakage
};

export const VEHICLES = [
  { id: 'car', label: 'Sedan', capacityLbs: 250 },
  { id: 'minivan', label: 'Minivan / SUV', capacityLbs: 550 },
  { id: 'pickup', label: 'Pickup truck', capacityLbs: 900 },
  { id: 'van', label: 'Cargo van', capacityLbs: 1500 },
] as const;

export interface ResourcePlan {
  planningLbs: number;
  meals: { low: number; median: number; high: number };
  boxes: number;
  pallets: number;
  storageSqft: number;
  volunteers: { total: number; perDay: number; greeters: number; sorters: number; drivers: number; volunteerHours: number };
  vehicles: { label: string; count: number; capacityLbs: number }[];
  vehicleTrips: number;
  categorySplit: { category: FoodCategory; label: string; color: string; lbs: number; share: number }[];
}

/** Category mix learned from history, shrunk toward priors when a category is rare. */
export function learnedCategoryShares(history: FoodDrive[]): Record<FoodCategory, number> {
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const d of history) {
    if (!d.collectedByCategory || !d.collectedLbs) continue;
    const accepted = d.acceptedCategories;
    const priorTotal = accepted.reduce((a, c) => a + CATEGORY_BY_ID[c].priorShare, 0);
    for (const c of accepted) {
      // Normalize each drive's share relative to what its accepted set would predict.
      const observed = (d.collectedByCategory[c] ?? 0) / d.collectedLbs;
      const relative = observed / (CATEGORY_BY_ID[c].priorShare / priorTotal);
      acc[c] ??= { sum: 0, n: 0 };
      acc[c].sum += relative;
      acc[c].n += 1;
    }
  }
  const K = 5; // prior weight in "drives"
  return Object.fromEntries(
    CATEGORIES.map((c) => {
      const a = acc[c.id] ?? { sum: 0, n: 0 };
      const relative = (a.sum + K) / (a.n + K);
      return [c.id, c.priorShare * relative];
    }),
  ) as Record<FoodCategory, number>;
}

function chooseVehicles(lbs: number): { label: string; count: number; capacityLbs: number }[] {
  // Greedy: cover bulk with the largest vehicle a typical volunteer team can borrow,
  // then the smallest vehicle that fits the remainder.
  const out: Record<string, { label: string; count: number; capacityLbs: number }> = {};
  let remaining = lbs;
  const big = VEHICLES[VEHICLES.length - 1];
  while (remaining > big.capacityLbs) {
    out[big.id] ??= { label: big.label, count: 0, capacityLbs: big.capacityLbs };
    out[big.id].count++;
    remaining -= big.capacityLbs;
  }
  if (remaining > 0) {
    const fit = VEHICLES.find((v) => v.capacityLbs >= remaining) ?? big;
    out[fit.id] ??= { label: fit.label, count: 0, capacityLbs: fit.capacityLbs };
    out[fit.id].count++;
  }
  return Object.values(out);
}

export function planResources(
  fc: Forecast,
  input: { participants: number; durationDays: number; categories: FoodCategory[]; shelterCount: number },
  shares: Record<FoodCategory, number>,
): ResourcePlan {
  const A = ASSUMPTIONS;
  // Size containers and storage for the HIGH end so a successful drive never runs out of boxes.
  const planningLbs = fc.high;
  const boxes = Math.ceil((planningLbs / A.lbsPerBox) * (1 + A.bufferPct));
  const pallets = Math.max(1, Math.ceil(boxes / A.boxesPerPallet));

  const days = Math.max(1, input.durationDays);
  const donorsPerHour = input.participants / (days * A.collectionHoursPerDay);
  const greeters = Math.max(2, Math.ceil(donorsPerHour / A.donorsPerGreeterHour));
  const sortHours = fc.median / A.lbsSortedPerVolunteerHour;
  const sorters = Math.max(2, Math.ceil(sortHours / days / A.shiftHours));
  const vehicles = chooseVehicles(fc.median);
  const drivers = vehicles.reduce((a, v) => a + v.count, 0);
  const shiftsPerDay = Math.ceil(A.collectionHoursPerDay / A.shiftHours);
  const perDay = (greeters + sorters) * shiftsPerDay;
  // Volunteers usually cover several shifts on multi-day drives; assume ~2 shifts each.
  const total = Math.ceil((perDay * days) / Math.min(days * shiftsPerDay, 2)) + drivers;
  const volunteerHours = Math.round(perDay * days * A.shiftHours + drivers * 2);

  const accepted = input.categories.length ? input.categories : CATEGORIES.map((c) => c.id);
  const shareSum = accepted.reduce((a, c) => a + shares[c], 0);
  const categorySplit = accepted.map((c) => ({
    category: c,
    label: CATEGORY_BY_ID[c].label,
    color: CATEGORY_BY_ID[c].color,
    share: shares[c] / shareSum,
    lbs: Math.round((fc.median * shares[c]) / shareSum),
  }));

  return {
    planningLbs,
    meals: { low: Math.round(fc.low / LBS_PER_MEAL), median: Math.round(fc.median / LBS_PER_MEAL), high: Math.round(fc.high / LBS_PER_MEAL) },
    boxes,
    pallets,
    storageSqft: pallets * A.sqftPerPallet,
    volunteers: { total, perDay, greeters, sorters, drivers, volunteerHours },
    vehicles,
    vehicleTrips: Math.max(drivers, input.shelterCount),
    categorySplit: categorySplit.sort((a, b) => b.lbs - a.lbs),
  };
}

/** Verified unmet need (in lbs) at the N nearest shelters, by category. */
export function nearbyDemand(location: { lat: number; lng: number }, shelters: Shelter[], n: number, categories: FoodCategory[]) {
  const nearest = [...shelters]
    .map((s) => ({ s, miles: haversineMiles(location, s.location) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, n);
  const byCategory: Partial<Record<FoodCategory, number>> = {};
  for (const { s } of nearest) {
    for (const need of s.needs) {
      if (!categories.includes(need.category)) continue;
      const lbs = Math.max(0, need.quantityNeeded - need.quantityReceived) * need.lbsPerUnit;
      byCategory[need.category] = (byCategory[need.category] ?? 0) + lbs;
    }
  }
  const total = Object.values(byCategory).reduce((a, b) => a + (b ?? 0), 0);
  return { shelters: nearest, byCategory, total: Math.round(total) };
}

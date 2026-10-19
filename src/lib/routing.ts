// Smart Delivery Planning — a small vehicle-routing heuristic.
//
// 1. Split stops into trips that fit the vehicle's capacity (sweep by angle
//    around the drive location, so each trip covers one "side" of town).
// 2. Order stops within each trip with nearest-neighbor, then improve with
//    2-opt (reverse any segment that makes the loop shorter) until no gain.
// 3. Compare with the naive plan: a separate round trip to every shelter.
// Distances are straight-line × circuity factor; a routing API can replace
// `roadMiles` later without changing this file's logic.

import type { LatLng } from './types';
import { roadMiles } from './geo';

export interface Stop {
  id: string;
  name: string;
  location: LatLng;
  lbs: number;
}

export interface Trip {
  stops: Stop[];
  miles: number;
  loadLbs: number;
}

export interface RoutePlan {
  trips: Trip[];
  totalMiles: number;
  naiveMiles: number;
  savedPct: number;
}

function loopMiles(depot: LatLng, order: Stop[]): number {
  if (!order.length) return 0;
  let d = roadMiles(depot, order[0].location);
  for (let i = 1; i < order.length; i++) d += roadMiles(order[i - 1].location, order[i].location);
  return d + roadMiles(order[order.length - 1].location, depot);
}

function nearestNeighbor(depot: LatLng, stops: Stop[]): Stop[] {
  const left = [...stops];
  const out: Stop[] = [];
  let cur = depot;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (roadMiles(cur, left[i].location) < roadMiles(cur, left[bi].location)) bi = i;
    const [next] = left.splice(bi, 1);
    out.push(next);
    cur = next.location;
  }
  return out;
}

export function twoOpt(depot: LatLng, order: Stop[]): Stop[] {
  let best = [...order];
  let bestLen = loopMiles(depot, best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const len = loopMiles(depot, cand);
        if (len < bestLen - 1e-9) {
          best = cand;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
}

export function planRoutes(depot: LatLng, stops: Stop[], capacityLbs: number): RoutePlan {
  const sorted = [...stops].sort(
    (a, b) =>
      Math.atan2(a.location.lat - depot.lat, a.location.lng - depot.lng) -
      Math.atan2(b.location.lat - depot.lat, b.location.lng - depot.lng),
  );
  const groups: Stop[][] = [];
  let cur: Stop[] = [];
  let load = 0;
  for (const s of sorted) {
    // A stop larger than one vehicle load is split across trips.
    let remaining = s.lbs;
    while (remaining > 0) {
      const room = capacityLbs - load;
      if (room <= 0) {
        groups.push(cur);
        cur = [];
        load = 0;
        continue;
      }
      const take = Math.min(room, remaining);
      cur.push({ ...s, lbs: take });
      load += take;
      remaining -= take;
    }
  }
  if (cur.length) groups.push(cur);

  const trips: Trip[] = groups.map((g) => {
    const ordered = twoOpt(depot, nearestNeighbor(depot, g));
    return { stops: ordered, miles: loopMiles(depot, ordered), loadLbs: g.reduce((a, s) => a + s.lbs, 0) };
  });
  const totalMiles = trips.reduce((a, t) => a + t.miles, 0);
  const naiveMiles = stops.reduce((a, s) => a + Math.ceil(s.lbs / capacityLbs) * 2 * roadMiles(depot, s.location), 0);
  return { trips, totalMiles, naiveMiles, savedPct: naiveMiles > 0 ? Math.max(0, 1 - totalMiles / naiveMiles) : 0 };
}

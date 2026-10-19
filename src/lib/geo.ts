import type { LatLng } from './types';

const EARTH_RADIUS_MI = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in miles (haversine formula). */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

/**
 * Streets are not straight lines. A circuity factor of ~1.3 is a common
 * planning estimate for converting straight-line to road distance in U.S. cities.
 * Swap this for a routing API (e.g. OSRM) when going to production.
 */
export const ROAD_CIRCUITY = 1.3;

export function roadMiles(a: LatLng, b: LatLng): number {
  return haversineMiles(a, b) * ROAD_CIRCUITY;
}

export function formatMiles(mi: number): string {
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

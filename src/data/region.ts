import type { LatLng } from '../lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// DEMO REGION. All organizations, people and numbers in this prototype are
// FICTIONAL. The map is centered on a real U.S. city only so the base map has
// streets. Change REGION_CENTER to your own congressional district to re-seed
// the demo around your community.
// ─────────────────────────────────────────────────────────────────────────────

export const REGION_NAME = 'Tri-Valley';
// Dublin, California (Tri-Valley, Alameda County)
export const REGION_CENTER: LatLng = { lat: 37.7022, lng: -121.9358 };

/** Neighborhood centers, as offsets in degrees from REGION_CENTER. Names are invented. */
export const NEIGHBORHOODS: { name: string; dLat: number; dLng: number }[] = [
  { name: 'Maple Heights', dLat: 0.063, dLng: -0.019 }, // near San Ramon
  { name: 'Cedar Flats', dLat: -0.037, dLng: 0.031 }, // near west Pleasanton
  { name: 'Riverside', dLat: 0.003, dLng: 0.011 }, // central Dublin
  { name: 'Eastbrook', dLat: 0.003, dLng: 0.136 }, // near north Livermore
  { name: 'Northgate', dLat: 0.068, dLng: 0.016 }, // near Dougherty Valley
  { name: 'Willow Creek', dLat: -0.012, dLng: 0.046 }, // near Hacienda, Pleasanton
  { name: 'Southpoint', dLat: -0.047, dLng: 0.081 }, // near southeast Pleasanton
  { name: 'Old Mill', dLat: 0.008, dLng: 0.061 }, // near east Dublin
  { name: 'Westfield', dLat: -0.007, dLng: -0.139 }, // near Castro Valley
  { name: 'Harbor Hill', dLat: -0.022, dLng: 0.166 }, // near Livermore
];

export function neighborhoodCenter(name: string): LatLng {
  const n = NEIGHBORHOODS.find((x) => x.name === name) ?? NEIGHBORHOODS[0];
  return { lat: REGION_CENTER.lat + n.dLat, lng: REGION_CENTER.lng + n.dLng };
}

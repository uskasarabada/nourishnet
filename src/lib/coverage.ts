// Coverage-gap map: where is documented need high but food drive activity low?
//
// For each cell in a grid over the region:
//   need(cell)     = Σ needIndex_i · K(distance)          (community need points)
//   coverage(cell) = Σ lbsCollected_j · K(distance)        (past 24 months of drives)
// with a Gaussian kernel K(d) = exp(−d² / 2h²). Both surfaces are scaled to
// 0–1, and gap = max(0, need − coverage). High gap = good place for a new drive.

import type { CommunityNeedPoint, FoodDrive, LatLng } from './types';
import { haversineMiles } from './geo';
import { daysFromToday } from './dates';

export interface GapCell {
  bounds: [[number, number], [number, number]];
  center: LatLng;
  need: number;
  coverage: number;
  gap: number;
}

const kernel = (d: number, h: number) => Math.exp((-d * d) / (2 * h * h));

export function coverageGrid(center: LatLng, needs: CommunityNeedPoint[], drives: FoodDrive[], size = 16, spanDeg = 0.3, bandwidthMi = 2): GapCell[] {
  const recent = drives.filter((d) => d.status === 'completed' && d.collectedLbs && daysFromToday(d.startDate) > -730);
  const step = spanDeg / size;
  const raw: GapCell[] = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const lat0 = center.lat - spanDeg / 2 + i * step;
      const lng0 = center.lng - (spanDeg * 1.3) / 2 + j * step * 1.3;
      const c = { lat: lat0 + step / 2, lng: lng0 + (step * 1.3) / 2 };
      const need = needs.reduce((a, p) => a + p.needIndex * kernel(haversineMiles(c, p.location), bandwidthMi), 0);
      const coverage = recent.reduce((a, d) => a + d.collectedLbs! * kernel(haversineMiles(c, d.location), bandwidthMi), 0);
      raw.push({ bounds: [[lat0, lng0], [lat0 + step, lng0 + step * 1.3]], center: c, need, coverage, gap: 0 });
    }
  }
  const maxNeed = Math.max(...raw.map((r) => r.need), 1e-9);
  const maxCov = Math.max(...raw.map((r) => r.coverage), 1e-9);
  return raw.map((r) => {
    const need = r.need / maxNeed;
    const coverage = r.coverage / maxCov;
    return { ...r, need, coverage, gap: Math.max(0, need - coverage) };
  });
}

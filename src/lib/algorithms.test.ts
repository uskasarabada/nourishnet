import { describe, expect, it } from 'vitest';
import { DRIVES, SHELTERS } from '../data/seed';
import { fitModel, forecast, rollingBacktest, rowsFromDrives } from './forecast';
import { invert } from './linalg';
import { matchDonations, supplyFromTotals } from './matching';
import { planRoutes } from './routing';
import { urgency } from './urgency';
import { forecastShelterNeed, holt } from './needForecast';
import { haversineMiles } from './geo';

describe('linear algebra', () => {
  it('inverts a matrix', () => {
    const inv = invert([[4, 7], [2, 6]]);
    expect(inv[0][0]).toBeCloseTo(0.6);
    expect(inv[0][1]).toBeCloseTo(-0.7);
    expect(inv[1][0]).toBeCloseTo(-0.2);
    expect(inv[1][1]).toBeCloseTo(0.4);
  });
});

describe('geo', () => {
  it('computes haversine distance (≈ 1 degree latitude = 69 mi)', () => {
    expect(haversineMiles({ lat: 40, lng: -83 }, { lat: 41, lng: -83 })).toBeCloseTo(69.1, 0);
  });
});

describe('collection forecast', () => {
  const rows = rowsFromDrives(DRIVES);
  const model = fitModel(rows);

  it('produces an ordered, positive interval', () => {
    const f = forecast(model, { orgType: 'school', participants: 500, durationDays: 5, month: 10, categories: ['grains', 'protein', 'canned_veg'] });
    expect(f.low).toBeGreaterThan(0);
    expect(f.low).toBeLessThan(f.median);
    expect(f.median).toBeLessThan(f.high);
  });

  it('predicts more food for more participants, longer events, and the holidays', () => {
    const base = { orgType: 'school' as const, participants: 300, durationDays: 3, month: 4, categories: ['grains' as const, 'protein' as const] };
    const m = forecast(model, base).median;
    expect(forecast(model, { ...base, participants: 600 }).median).toBeGreaterThan(m);
    expect(forecast(model, { ...base, durationDays: 7 }).median).toBeGreaterThan(m);
    expect(forecast(model, { ...base, month: 10 }).median).toBeGreaterThan(m);
  });

  it('widens the interval when participants are unknown', () => {
    const known = forecast(model, { orgType: 'faith', participants: 150, durationDays: 2, month: 3, categories: ['grains'] });
    const unknown = forecast(model, { orgType: 'faith', durationDays: 2, month: 3, categories: ['grains'] });
    expect(unknown.participantsEstimated).toBe(true);
    expect(unknown.sigmaLog).toBeGreaterThan(known.sigmaLog);
  });

  it('beats the naive pounds-per-participant baseline in a rolling backtest', () => {
    const bt = rollingBacktest(rows);
    expect(bt.mape).toBeLessThan(bt.baselineMape);
    expect(bt.coverage80).toBeGreaterThan(0.6);
  });
});

describe('urgency', () => {
  it('stays in 0–100 and ranks a critical kitchen above a well-stocked pantry', () => {
    for (const s of SHELTERS) {
      const u = urgency(s);
      expect(u.score).toBeGreaterThanOrEqual(0);
      expect(u.score).toBeLessThanOrEqual(100);
    }
    const kitchen = urgency(SHELTERS.find((s) => s.id === 'sh-st')!);
    const pantry = urgency(SHELTERS.find((s) => s.id === 'sh-north')!);
    expect(kitchen.score).toBeGreaterThan(pantry.score);
  });
});

describe('matching', () => {
  const origin = DRIVES.find((d) => d.id === 'dr-a01')!.location;
  const supply = supplyFromTotals({ grains: 200, protein: 180, canned_veg: 120, produce: 60 });

  it('never allocates more than the supply or than a shelter requested', () => {
    const r = matchDonations(origin, supply, SHELTERS, { maxMiles: 25, locks: {}, excluded: [] });
    expect(r.totalAllocated).toBeLessThanOrEqual(r.totalSupply + 1);
    for (const a of r.allocations) {
      const s = SHELTERS.find((x) => x.id === a.shelterId)!;
      for (const [cat, lbs] of Object.entries(a.byCategory)) {
        const need = s.needs.filter((n) => n.category === cat).reduce((acc, n) => acc + (n.quantityNeeded - n.quantityReceived) * n.lbsPerUnit, 0);
        expect(lbs!).toBeLessThanOrEqual(need + 1);
      }
    }
  });

  it('sends perishables only to refrigerated shelters', () => {
    const r = matchDonations(origin, supply, SHELTERS, { maxMiles: 25, locks: {}, excluded: [] });
    for (const a of r.allocations) {
      if (a.byCategory.produce) expect(SHELTERS.find((s) => s.id === a.shelterId)!.storage.refrigerated).toBe(true);
    }
  });

  it('honors organizer locks and exclusions', () => {
    const r = matchDonations(origin, supply, SHELTERS, { maxMiles: 25, locks: { 'sh-mid': 150 }, excluded: ['sh-hope'] });
    expect(r.allocations.find((a) => a.shelterId === 'sh-mid')!.totalLbs).toBe(150);
    expect(r.allocations.find((a) => a.shelterId === 'sh-hope')).toBeUndefined();
  });
});

describe('routing', () => {
  it('2-opt route is never longer than separate round trips', () => {
    const depot = DRIVES[0].location;
    const stops = SHELTERS.slice(0, 5).map((s) => ({ id: s.id, name: s.name, location: s.location, lbs: 200 }));
    const plan = planRoutes(depot, stops, 1500);
    expect(plan.totalMiles).toBeLessThanOrEqual(plan.naiveMiles + 1e-6);
    expect(plan.trips.reduce((a, t) => a + t.loadLbs, 0)).toBe(1000);
  });
});

describe('need forecasting', () => {
  it('Holt smoothing follows a linear trend', () => {
    const fit = holt([100, 110, 120, 130, 140, 150], 0.8, 0.5);
    expect(fit.level + fit.trend).toBeGreaterThan(150);
  });
  it('produces a 6-week horizon for every shelter', () => {
    for (const s of SHELTERS) expect(forecastShelterNeed(s).weeks.filter((w) => w.demand !== undefined)).toHaveLength(6);
  });
});

import { normalCdf, probabilityOfGoal } from './forecast';
describe('goal probability', () => {
  it('normal CDF matches known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.2816)).toBeCloseTo(0.9, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
  it('goal at the median is a coin flip', () => {
    const model = fitModel(rowsFromDrives(DRIVES));
    const f = forecast(model, { orgType: 'school', participants: 400, durationDays: 3, month: 9, categories: ['grains'] });
    expect(probabilityOfGoal(f, f.median)).toBeCloseTo(0.5, 3);
    expect(probabilityOfGoal(f, f.low)).toBeCloseTo(0.9, 2);
  });
});

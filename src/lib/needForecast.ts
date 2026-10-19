// Community Need Forecasting: will a shelter run short in the coming weeks?
//
// 1. Forecast weekly demand with Holt's linear (double exponential) smoothing,
//    which tracks both the level and the trend of the shelter's distribution.
// 2. Project inventory forward:  inventory[t+1] = inventory[t] + supply − demand[t].
// 3. Flag a shortage when projected inventory falls below half a week of demand
//    (a simple safety-stock rule).

import type { Shelter } from './types';
import { Z80 } from './forecast';

/** Shortage = projected inventory below this many weeks of demand. */
export const SAFETY_WEEKS = 0.5;

export interface HoltFit {
  level: number;
  trend: number;
  sigma: number;
  fitted: number[];
}

export function holt(series: number[], alpha = 0.5, beta = 0.2): HoltFit {
  let level = series[0];
  let trend = series.length > 1 ? series[1] - series[0] : 0;
  const fitted: number[] = [level];
  const errors: number[] = [];
  for (let t = 1; t < series.length; t++) {
    const forecastT = level + trend;
    fitted.push(forecastT);
    errors.push(series[t] - forecastT);
    const prevLevel = level;
    level = alpha * series[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const sigma = Math.sqrt(errors.reduce((a, e) => a + e * e, 0) / Math.max(1, errors.length - 2));
  return { level, trend, sigma, fitted };
}

/** Picks smoothing parameters by minimizing one-step-ahead squared error on a small grid. */
export function tuneHolt(series: number[]): { alpha: number; beta: number; fit: HoltFit } {
  let best = { alpha: 0.5, beta: 0.2, fit: holt(series, 0.5, 0.2) };
  for (const alpha of [0.2, 0.3, 0.4, 0.5, 0.6, 0.8]) {
    for (const beta of [0.05, 0.1, 0.2, 0.3]) {
      const fit = holt(series, alpha, beta);
      if (fit.sigma < best.fit.sigma) best = { alpha, beta, fit };
    }
  }
  return best;
}

export interface NeedForecastWeek {
  week: string;
  actual?: number;
  demand?: number;
  demandLow?: number;
  demandHigh?: number;
  inventory?: number;
  safetyStock?: number;
}

export interface NeedForecast {
  shelterId: string;
  weeks: NeedForecastWeek[];
  shortageWeek: number | null; // weeks from now, 1-based
  projectedGapLbs: number; // how many lbs short at the worst point
  trendPctPerWeek: number;
  params: { alpha: number; beta: number };
}

export function forecastShelterNeed(s: Shelter, horizon = 6): NeedForecast {
  const hist = s.weeklyDistributionLbs;
  const { alpha, beta, fit } = tuneHolt(hist);
  const weeks: NeedForecastWeek[] = hist.map((v, i) => ({ week: `W${i - hist.length + 1}`, actual: v }));
  weeks[weeks.length - 1].week = 'Now';
  weeks[weeks.length - 1].inventory = s.currentInventoryLbs;

  let inventory = s.currentInventoryLbs;
  let shortageWeek: number | null = null;
  let worstGap = 0;
  for (let h = 1; h <= horizon; h++) {
    const demand = Math.max(0, fit.level + h * fit.trend);
    const spread = Z80 * fit.sigma * Math.sqrt(h);
    inventory = inventory + s.weeklyBaselineSupplyLbs - demand;
    const safety = SAFETY_WEEKS * demand;
    if (inventory < safety && shortageWeek === null) shortageWeek = h;
    worstGap = Math.max(worstGap, safety - inventory);
    weeks.push({
      week: `+${h}w`,
      demand: Math.round(demand),
      demandLow: Math.round(Math.max(0, demand - spread)),
      demandHigh: Math.round(demand + spread),
      inventory: Math.round(Math.max(0, inventory)),
      safetyStock: Math.round(safety),
    });
  }
  return {
    shelterId: s.id,
    weeks,
    shortageWeek,
    projectedGapLbs: Math.round(Math.max(0, worstGap)),
    trendPctPerWeek: (fit.trend / Math.max(1, fit.level)) * 100,
    params: { alpha, beta },
  };
}

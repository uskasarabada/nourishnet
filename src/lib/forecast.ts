// ─────────────────────────────────────────────────────────────────────────────
// NourishNet Collection Forecast — an explainable log-linear regression.
//
//   log(lbs / participants) = base[orgType]
//                           + α · log(days)                 (diminishing returns)
//                           + β₁·cos(month) + β₂·sin(month)  (smooth seasonality)
//                           + γ · holiday(Nov/Dec)            (holiday bump)
//                           + δ · log(categories / 8)         (variety accepted)
//                           + ε,   ε ~ Normal(0, σ²)
//
// Equivalently: lbs = participants × rate × days^α × season × variety × noise,
// so every factor is a multiplier a person can read ("×1.38 for the holidays").
//
// The coefficients are fitted with *regularized least squares toward priors*
// (a Bayesian MAP estimate). With little data, predictions stay near sensible
// priors; as completed drives accumulate, the data takes over. On top of the
// regression we add a shrunken adjustment from the organizer's own past drives
// (or nearby drives), so local history improves the forecast without letting a
// single unusual event dominate it.
// ─────────────────────────────────────────────────────────────────────────────

import type { FoodCategory, FoodDrive, LatLng, OrgType } from './types';
import { dot, invert, matVec, mean, median, variance, zeros, type Matrix, type Vector } from './linalg';
import { haversineMiles } from './geo';
import { monthOf } from './dates';

export const ORG_TYPES: OrgType[] = ['school', 'nonprofit', 'faith', 'business', 'student_group'];
export const ORG_LABEL: Record<OrgType, string> = {
  school: 'School',
  nonprofit: 'Nonprofit',
  faith: 'Faith community',
  business: 'Business',
  student_group: 'Student club',
};

export const FEATURE_NAMES = [
  'Base rate · School',
  'Base rate · Nonprofit',
  'Base rate · Faith community',
  'Base rate · Business',
  'Base rate · Student club',
  'Duration exponent',
  'Season (cosine)',
  'Season (sine)',
  'Holiday bump',
  'Variety exponent',
];

/** Prior beliefs before seeing any local data (documented in docs/ALGORITHMS.md). */
const PRIOR_MEAN: Vector = [Math.log(1.5), Math.log(2.2), Math.log(2.2), Math.log(1.8), Math.log(1.3), 0.6, 0, 0, Math.log(1.3), 0.3];
/** How strongly we hold each prior — roughly "worth this many drives of evidence". */
const PRIOR_STRENGTH: Vector = [2, 2, 2, 2, 2, 4, 3, 3, 3, 4];
/** Prior on noise: a typical drive lands within ±35% (log σ≈0.35), held with 4 drives' weight. */
const PRIOR_SIGMA = 0.35;
const PRIOR_SIGMA_WEIGHT = 4;
/** z-score for an 80% two-sided interval. */
export const Z80 = 1.2816;

export interface DriveFeatures {
  orgType: OrgType;
  organization?: string;
  participants?: number; // undefined = unknown
  durationDays: number;
  month: number; // 0–11
  categories: FoodCategory[];
  location?: LatLng;
}

export interface TrainingRow extends DriveFeatures {
  id: string;
  participants: number;
  /** Participants the organizer expected at planning time. */
  plannedParticipants: number;
  lbs: number;
  date: string;
}

export interface Model {
  theta: Vector;
  covUnscaled: Matrix; // (XᵀX + Λ)⁻¹
  sigma: number; // residual std-dev in log space
  rows: TrainingRow[];
  residuals: number[];
}

export function featureVector(f: { orgType: OrgType; durationDays: number; month: number; categories: FoodCategory[] }): Vector {
  const angle = (2 * Math.PI * f.month) / 12;
  return [
    ...ORG_TYPES.map((t) => (t === f.orgType ? 1 : 0)),
    Math.log(Math.max(1, f.durationDays)),
    Math.cos(angle),
    Math.sin(angle),
    f.month >= 10 ? 1 : 0,
    Math.log(Math.max(1, f.categories.length) / 8),
  ];
}

export function rowsFromDrives(drives: FoodDrive[]): TrainingRow[] {
  return drives
    .filter((d) => d.status === 'completed' && d.collectedLbs && (d.actualParticipants ?? d.expectedParticipants) > 0)
    .map((d) => ({
      id: d.id,
      orgType: d.orgType,
      organization: d.organization,
      participants: d.actualParticipants ?? d.expectedParticipants,
      plannedParticipants: d.expectedParticipants,
      durationDays: d.durationDays,
      month: monthOf(d.startDate),
      categories: d.acceptedCategories,
      location: d.location,
      lbs: d.collectedLbs!,
      date: d.startDate,
    }));
}

/** Fits the regression: θ = (XᵀX + Λ)⁻¹ (Xᵀy + Λθ₀). */
export function fitModel(rows: TrainingRow[]): Model {
  const p = PRIOR_MEAN.length;
  const XtX = zeros(p, p);
  const Xty = new Array(p).fill(0);
  const X = rows.map(featureVector);
  const y = rows.map((r) => Math.log(r.lbs / r.participants));
  X.forEach((x, n) => {
    for (let i = 0; i < p; i++) {
      Xty[i] += x[i] * y[n];
      for (let j = 0; j < p; j++) XtX[i][j] += x[i] * x[j];
    }
  });
  for (let i = 0; i < p; i++) {
    XtX[i][i] += PRIOR_STRENGTH[i];
    Xty[i] += PRIOR_STRENGTH[i] * PRIOR_MEAN[i];
  }
  const covUnscaled = invert(XtX);
  const theta = matVec(covUnscaled, Xty);
  const residuals = X.map((x, n) => y[n] - dot(x, theta));
  const sse = residuals.reduce((a, r) => a + r * r, 0);
  const sigma = Math.sqrt((sse + PRIOR_SIGMA_WEIGHT * PRIOR_SIGMA ** 2) / (rows.length + PRIOR_SIGMA_WEIGHT));
  return { theta, covUnscaled, sigma, rows, residuals };
}

export interface ForecastStep {
  label: string;
  detail: string;
  factor: number; // multiplier applied at this step (first step: lbs)
  running: number; // lbs after this step
}

export interface Forecast {
  median: number;
  low: number;
  high: number;
  sigmaLog: number;
  steps: ForecastStep[];
  participantsUsed: number;
  participantsEstimated: boolean;
  adjustment: { kind: 'organization' | 'nearby' | 'none'; factor: number; evidence: number; description: string };
  dataStrength: { level: 'Strong' | 'Moderate' | 'Limited'; similar: number; explanation: string };
  ratePerParticipant: number;
}

const DURATION_LABEL = (d: number) => (d === 1 ? '1 day' : `${d} days`);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Estimates participants from similar organizations when the organizer leaves it blank. */
function estimateParticipants(model: Model, f: DriveFeatures): { value: number; logVar: number } {
  const same = model.rows.filter((r) => (f.organization && r.organization === f.organization) || r.orgType === f.orgType);
  const logs = (same.length ? same : model.rows).map((r) => Math.log(r.participants));
  return { value: Math.round(Math.exp(median(logs))), logVar: Math.max(variance(logs), 0.15) };
}

/** Shrunken mean of past residuals — the organization's own track record, else nearby drives. */
function historyAdjustment(model: Model, f: DriveFeatures): Forecast['adjustment'] {
  const own = model.rows
    .map((r, i) => ({ r, res: model.residuals[i] }))
    .filter((x) => f.organization && x.r.organization === f.organization);
  if (own.length > 0) {
    const shrink = own.length / (own.length + 2);
    const factor = Math.exp(shrink * mean(own.map((x) => x.res)));
    return {
      kind: 'organization',
      factor,
      evidence: own.length,
      description: `${own.length} past drive${own.length > 1 ? 's' : ''} by this organization ran ${factor >= 1 ? 'above' : 'below'} the typical rate; we apply ${Math.round(shrink * 100)}% of that difference.`,
    };
  }
  if (f.location) {
    let wSum = 0;
    let wRes = 0;
    model.rows.forEach((r, i) => {
      if (!r.location) return;
      const d = haversineMiles(f.location!, r.location);
      const w = Math.exp(-0.5 * (d / 1.5) ** 2); // Gaussian kernel, 1.5-mile bandwidth
      wSum += w;
      wRes += w * model.residuals[i];
    });
    if (wSum > 0.3) {
      const factor = Math.exp(wRes / (wSum + 3));
      return {
        kind: 'nearby',
        factor,
        evidence: Math.round(wSum * 10) / 10,
        description: `Drives within ~2 miles ran ${factor >= 1 ? 'above' : 'below'} typical; adjustment shrunk toward 1 because nearby evidence is limited.`,
      };
    }
  }
  return { kind: 'none', factor: 1, evidence: 0, description: 'No organizational or nearby history yet — using the regional model only.' };
}

export function forecast(model: Model, f: DriveFeatures): Forecast {
  const x = featureVector(f);
  const t = model.theta;
  const est = f.participants && f.participants > 0 ? null : estimateParticipants(model, f);
  const P = est ? est.value : f.participants!;
  const adj = historyAdjustment(model, f);

  const orgIdx = ORG_TYPES.indexOf(f.orgType);
  const rate = Math.exp(t[orgIdx]);
  const durF = Math.exp(t[5] * x[5]);
  const seasonF = Math.exp(t[6] * x[6] + t[7] * x[7] + t[8] * x[8]);
  const varietyF = Math.exp(t[9] * x[9]);

  const steps: ForecastStep[] = [];
  let running = P * rate;
  steps.push({
    label: 'Starting point',
    detail: `${P.toLocaleString()} participants${est ? ' (estimated)' : ''} × ${rate.toFixed(2)} lb each, learned for ${ORG_LABEL[f.orgType].toLowerCase()} drives`,
    factor: running,
    running,
  });
  running *= durF;
  steps.push({ label: 'Event length', detail: `${DURATION_LABEL(f.durationDays)} — longer drives collect more, with diminishing returns (days^${t[5].toFixed(2)})`, factor: durF, running });
  running *= seasonF;
  steps.push({ label: 'Time of year', detail: `${MONTHS[f.month]} giving pattern${f.month >= 10 ? ', including the holiday bump' : ''}`, factor: seasonF, running });
  running *= varietyF;
  steps.push({ label: 'Food types accepted', detail: `${f.categories.length} of 8 categories — more options make it easier to give`, factor: varietyF, running });
  running *= adj.factor;
  steps.push({ label: 'Local track record', detail: adj.description, factor: adj.factor, running });

  // Prediction variance in log space: noise + parameter uncertainty (+ unknown participants).
  const paramVar = model.sigma ** 2 * dot(x, matVec(model.covUnscaled, x));
  const adjVar = adj.kind === 'none' ? 0.02 : 0.02 / Math.max(1, adj.evidence);
  const sigmaLog = Math.sqrt(model.sigma ** 2 + paramVar + adjVar + (est ? est.logVar : 0));

  const similar = model.rows.filter(
    (r) => r.orgType === f.orgType && (!f.location || !r.location || haversineMiles(f.location, r.location) < 4),
  ).length;
  const level = similar >= 8 ? 'Strong' : similar >= 3 ? 'Moderate' : 'Limited';

  return {
    median: running,
    low: running * Math.exp(-Z80 * sigmaLog),
    high: running * Math.exp(Z80 * sigmaLog),
    sigmaLog,
    steps,
    participantsUsed: P,
    participantsEstimated: !!est,
    adjustment: adj,
    ratePerParticipant: running / P,
    dataStrength: {
      level,
      similar,
      explanation:
        level === 'Limited'
          ? `Only ${similar} similar past drive${similar === 1 ? '' : 's'} nearby. The range is intentionally wide — treat this as a starting estimate.`
          : `${similar} similar drives within 4 miles inform this forecast.`,
    },
  };
}

// ── Validation ─────────────────────────────────────────────────────────────

export interface BacktestPoint {
  id: string;
  date: string;
  actual: number;
  predicted: number;
  low: number;
  high: number;
  baseline: number;
  trainingSize: number;
}

export interface BacktestSummary {
  points: BacktestPoint[];
  mape: number;
  baselineMape: number;
  mae: number;
  coverage80: number;
  bias: number; // mean (pred - actual)/actual
}

/**
 * Rolling-origin backtest: for each completed drive (in date order), fit the
 * model only on drives that happened *before it* and predict it. This is
 * exactly what the app could have told that organizer at planning time.
 * The naive baseline is "participants × median pounds-per-participant so far".
 */
export function rollingBacktest(rows: TrainingRow[], minTrain = 6): BacktestSummary {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const points: BacktestPoint[] = [];
  for (let k = minTrain; k < sorted.length; k++) {
    const train = sorted.slice(0, k);
    const target = sorted[k];
    const m = fitModel(train);
    const fc = forecast(m, { ...target, participants: target.plannedParticipants });
    const naiveRate = median(train.map((r) => r.lbs / r.participants));
    points.push({
      id: target.id,
      date: target.date,
      actual: target.lbs,
      predicted: fc.median,
      low: fc.low,
      high: fc.high,
      baseline: naiveRate * target.plannedParticipants,
      trainingSize: k,
    });
  }
  return summarize(points);
}

export function summarize(points: BacktestPoint[]): BacktestSummary {
  const ape = points.map((p) => Math.abs(p.predicted - p.actual) / p.actual);
  const bape = points.map((p) => Math.abs(p.baseline - p.actual) / p.actual);
  return {
    points,
    mape: mean(ape),
    baselineMape: mean(bape),
    mae: mean(points.map((p) => Math.abs(p.predicted - p.actual))),
    coverage80: mean(points.map((p) => (p.actual >= p.low && p.actual <= p.high ? 1 : 0))),
    bias: mean(points.map((p) => (p.predicted - p.actual) / p.actual)),
  };
}

/** Error over time, smoothed with a trailing window — shows the model learning. */
export function learningCurve(points: BacktestPoint[], window = 8) {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1);
    return {
      trainingSize: p.trainingSize,
      date: p.date,
      model: Math.round(100 * mean(slice.map((s) => Math.abs(s.predicted - s.actual) / s.actual))),
      baseline: Math.round(100 * mean(slice.map((s) => Math.abs(s.baseline - s.actual) / s.actual))),
    };
  });
}

/** Human-readable coefficients for the "How it works" panel. */
export function describeModel(model: Model) {
  const t = model.theta;
  return {
    rates: ORG_TYPES.map((o, i) => ({ orgType: o, label: ORG_LABEL[o], lbsPerParticipant: Math.exp(t[i]), prior: Math.exp(PRIOR_MEAN[i]) })),
    durationExponent: t[5],
    seasonByMonth: MONTHS.map((name, m) => {
      const a = (2 * Math.PI * m) / 12;
      return { month: name.slice(0, 3), factor: Math.exp(t[6] * Math.cos(a) + t[7] * Math.sin(a) + t[8] * (m >= 10 ? 1 : 0)) };
    }),
    varietyExponent: t[9],
    sigma: model.sigma,
    n: model.rows.length,
  };
}

// ── Goal planning helpers ──────────────────────────────────────────────────

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 approximation of erf). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Probability the drive collects at least `goal` lb (forecast is log-normal). */
export function probabilityOfGoal(fc: Forecast, goal: number): number {
  if (goal <= 0) return 1;
  return 1 - normalCdf((Math.log(goal) - Math.log(fc.median)) / fc.sigmaLog);
}

/** Participants needed so the goal sits at the LOW end of the 80% range (≈90% chance). */
export function participantsForGoal(fc: Forecast, goal: number): number {
  return Math.ceil((fc.participantsUsed * goal) / fc.low);
}

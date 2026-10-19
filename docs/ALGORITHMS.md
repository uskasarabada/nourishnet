# NourishNet: Algorithms

All algorithms are hand-written TypeScript in `src/lib/`, with **no ML libraries**, so every step can be explained and tested. Unit tests live in `src/lib/algorithms.test.ts` (`npm test`).

| Module | Algorithm | Used on |
|---|---|---|
| `forecast.ts` | Regularized log-linear regression (Bayesian MAP), prediction intervals, rolling-origin backtest | Predict, Create, Dashboard, Drive, Landing |
| `resources.ts` | Logistics conversion with published planning assumptions; shrunken category shares | Predict, Create |
| `urgency.ts` | Transparent weighted score with staleness discount | Shelters, Match, Dashboard |
| `needForecast.ts` | Holt's linear exponential smoothing + inventory projection | Shelters, Dashboard |
| `matching.ts` | Constrained chunked greedy allocation with diminishing returns + organizer locks | Match |
| `routing.ts` | Capacity sweep + nearest neighbor + 2-opt | Match |
| `coverage.ts` | Gaussian kernel density, need − coverage | Map |
| `volunteers.ts` | Weighted preference scoring | Volunteer |
| `waste.ts` | Expiry-feasibility filter + ranking | Match, Dashboard |
| `geo.ts` | Haversine distance + road circuity factor | everywhere |
| `linalg.ts` | Gauss–Jordan matrix inversion | forecast |

---

## 1. Collection forecast (`forecast.ts`)

### Model
We predict pounds per participant on a log scale:

```
log(lbs / participants) = base[orgType]
                        + α·log(days)
                        + β₁·cos(2π·month/12) + β₂·sin(2π·month/12)
                        + γ·holiday(month ∈ {Nov, Dec})
                        + δ·log(categoriesAccepted / 8)
                        + ε,         ε ~ Normal(0, σ²)
```

Exponentiating gives a product of readable multipliers:
`lbs = participants × rate × days^α × season × variety × noise`. That's why the UI can show a step-by-step "waterfall" explanation.

**Why log scale?** Donations are positive and multiplicative (twice the people ≈ twice the food), and errors scale with drive size. Log-linear regression handles both.

### Inputs
| Input | Required? | If missing |
|---|---|---|
| Organization type | yes | n/a |
| Participants | no | Estimated as the median of similar organizations; its variance is **added** to the interval |
| Duration (days) | yes (default 1) | n/a |
| Month | yes | n/a |
| Food categories accepted | yes | n/a |
| Location | no | Skip the nearby adjustment |
| Organization name | no | Skip the track-record adjustment |
| Your own past drives | no | Added as extra training rows on the Predict page |

### Fitting: regularized least squares toward priors
With feature matrix X, target y, prior mean θ₀, and prior strength Λ (diagonal):

```
θ = (XᵀX + Λ)⁻¹ (Xᵀy + Λθ₀)
```

This is the MAP estimate under a Gaussian prior. Each prior strength is roughly "worth this many drives of evidence." With **zero data**, θ = θ₀ (sensible defaults: e.g. 1.5 lb/participant for schools, α = 0.6, holiday ×1.3). With **lots of data**, XᵀX dominates and the data wins.

Noise σ also has a prior (σ₀ = 0.35 with weight 4), so with few drives the interval stays wide.

### Local track record
After the regression, we compute residuals of past drives. If the organization has history, we apply a **shrunken** mean residual: `factor = exp(n/(n+2) × mean residual)`. Otherwise we use a Gaussian-kernel-weighted mean of residuals for drives within ~1.5 miles, shrunk by `Σw/(Σw+3)`. One unusual drive can't swing the forecast.

### Prediction interval (80%)
```
σ²_pred = σ² (noise)
        + σ²·xᵀ(XᵀX+Λ)⁻¹x   (uncertainty in coefficients; grows for unusual inputs)
        + adjustment variance
        + Var(log participants)  (only if participants were estimated)
range   = median × exp(±1.2816·σ_pred)
```

### Goal planning
Because the forecast is log-normal, `P(lbs ≥ goal) = 1 − Φ((ln goal − ln median)/σ_pred)`, where Φ is the standard normal CDF (Abramowitz–Stegun approximation). "Participants needed for ~90% confidence" scales participants so the goal sits at the low end of the 80% range.

### Avoiding misleading results with little data
- Priors keep coefficients sensible; the σ prior keeps intervals wide.
- A **data-strength badge** (Strong ≥ 8 similar nearby drives, Moderate ≥ 3, Limited < 3) with plain-language warnings.
- Missing inputs visibly widen the range rather than being silently filled.

### Validation & accuracy
**Rolling-origin backtest:** sort completed drives by date; for each drive k, fit using drives 1…k−1 only and predict drive k from its *planned* participant count. This mirrors real use exactly.

Metrics shown live on the Predict page:
- **MAPE** (mean absolute percentage error). Demo data: ≈20%
- **Baseline MAPE**: median lb/participant × participants. Demo data: ≈73%
- **80% interval coverage** (should be ≈80%). Demo data: ≈82%
- **Bias** (mean signed % error)
- **Learning curve**: trailing-window error as history grows

Forecasts made at drive creation are stored (`predictedLbs/Low/High`) so real drives are scored against what was actually predicted, not a later re-fit.

### About the synthetic data
`src/data/seed.ts` generates completed drives from a documented hidden process (`TRUE_RATE`, `TRUE_SEASON`, `TRUE_DURATION_EXP`, noise σ = 0.22, plus neighborhood effects) using a seeded PRNG. The model never reads those constants; it has to recover them. That makes the backtest a fair test. **The accuracy figures describe performance on synthetic data only** and must be re-measured on real drives.

---

## 2. Resource plan (`resources.ts`)
Converts the forecast to logistics using visible assumptions (`ASSUMPTIONS`):
- **Boxes** = ⌈high estimate ÷ 25 lb × 1.15⌉. Sized for the *upper* bound so you don't run out.
- **Storage** = pallets (40 boxes) × 20 sq ft.
- **Greeters/shift** = ⌈donors per hour ÷ 20⌉, min 2. **Sorters/shift** from 120 lb sorted per volunteer-hour.
- **Vehicles**: greedy. Cargo vans (1,500 lb) for bulk, then the smallest vehicle that fits the remainder.
- **Meals** = lbs ÷ 1.2 (Feeding America's planning conversion).
- **Category mix**: historical share per category relative to prior expectation, shrunk toward the prior with weight 5 drives, normalized over accepted categories. Compared with verified nearby need to suggest "Ask for more" / "Enough."

## 3. Urgency score (`urgency.ts`)
```
score = 100 × (0.35·severity + 0.25·deadline + 0.20·unmet + 0.20·lowInventory)
severity     = (reported 1–5 − 1) / 4
deadline     = clamp(1 − daysToNearestDeadline/30, 0, 1)
unmet        = unmet lbs / requested lbs
lowInventory = clamp(1 − daysOnHand/21, 0, 1)
```
Requests not re-verified within 14 days are flagged and multiplied by 0.85. Levels: Critical ≥ 75, High ≥ 55, Moderate ≥ 35, Low < 35. Emergency Mode shows only Critical/High verified within 72 h.

## 4. Shortage forecast (`needForecast.ts`)
Holt's linear smoothing on 16 weeks of distribution (level ℓ, trend b):
```
ℓₜ = α·yₜ + (1−α)(ℓₜ₋₁ + bₜ₋₁)
bₜ = β(ℓₜ − ℓₜ₋₁) + (1−β)bₜ₋₁
ŷₜ₊ₕ = ℓₜ + h·bₜ,   band ± 1.2816·σ·√h
```
α, β are chosen by grid search minimizing one-step-ahead error. Inventory is projected `invₜ₊₁ = invₜ + baselineSupply − demand`; a shortage is flagged when it falls below half a week of demand.

## 5. Smart matching (`matching.ts`)
Food is allocated in 10-lb chunks. Each chunk goes to the feasible (shelter, category) pair with the highest marginal score:
```
score = urgency/100 × √(remaining need ÷ original need) × 1/(1 + miles/5)
```
The square root creates diminishing returns, spreading food fairly instead of sending everything to the single most urgent site.
**Hard constraints:** max distance; shelter requested that category; request not filled; storage capacity; perishables only to refrigerated sites; `daysToExpiry − 1 ≥ shelter turnover days`.
**Organizer locks:** locked shelters are filled first (greedy restricted to that shelter, trimmed to target), then the rest is re-optimized. Infeasible locks produce a warning.
Each allocation returns human-readable reasons; excluded shelters get a "why not."
*Complexity:* O((supply/10) × candidates). Tiny for realistic inputs.

## 6. Delivery routes (`routing.ts`)
1. Sort stops by polar angle around the pickup (sweep) and cut into trips at vehicle capacity (splitting oversized stops).
2. Order each trip with nearest neighbor, then improve with **2-opt** until no segment reversal shortens the loop.
3. Compare with the naive plan (separate round trips per stop) to report savings.
Distances are haversine × 1.3 circuity factor; replace `roadMiles` with a routing API for production.

## 7. Coverage gaps (`coverage.ts`)
For a 16×16 grid: `need(c) = Σ needIndexᵢ·K(dᵢ)` and `coverage(c) = Σ lbsⱼ·K(dⱼ)` over drives in the last 24 months, with K(d) = exp(−d²/2h²), h = 2 mi. Both scaled to 0–1; `gap = max(0, need − coverage)`.

## 8. Volunteer matching (`volunteers.ts`)
`score = 40·availability + 25·(1 − miles/maxMiles) + 20·rolePreference + 15·shareOfSpotsOpen`, excluding full/past shifts and unavailable days.

## 9. Waste prevention (`waste.ts`)
Lots expiring within 10 days are flagged (urgent ≤ 5 days). Recipients must be able to store it (refrigeration if perishable), distribute it before expiry (`turnoverDays < daysLeft`), and want it (requested the category, or a community kitchen). Ranked by fastest turnover, then distance.

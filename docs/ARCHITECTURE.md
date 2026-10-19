# NourishNet: Architecture

## Current prototype

```
┌────────────────────────── Browser (React 18 + TypeScript + Vite) ──────────────────────────┐
│  pages/            10 screens + volunteer + report (React Router)                           │
│  components/       design system, Leaflet map wrapper, forecast visuals                     │
│  state/store.tsx   React context + reducer; derives model/backtest with useMemo             │
│  state/repository  ← the ONLY data boundary (load/save/reset)                               │
│  lib/              pure algorithms: forecast, matching, routing, urgency, … (unit-tested)   │
│  data/seed.ts      fictional demo data (seeded PRNG)                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
          │ localRepository → localStorage (demo only; per browser)
```

**Key decisions**
- **Pure functions in `lib/`.** No React, no I/O. They can be unit-tested and ported to Python line by line.
- **Model trains in the browser.** A 10-parameter regression on dozens to thousands of drives takes milliseconds. The store re-fits whenever the set of completed drives changes.
- **One data boundary (`Repository`).** Screens never touch storage directly, so swapping in a real backend touches only `state/`.

## Folder map
```
src/
  lib/          types, algorithms, tests
  data/         region config + synthetic seed
  state/        repository + store
  components/   ui kit, Layout, MapBase, forecastViews, Logo
  pages/        Landing, Dashboard, MapPage, Predict, Shelters, CreateDrive,
                DriveDetails, Match, Impact, Profile, Volunteer, Report
docs/           strategy, algorithms, design system, architecture
```

## Path to production

### Step 1: Real database (recommended: Supabase / Postgres)
Tables mirror `src/lib/types.ts`:

| Table | Key columns |
|---|---|
| `organizations` | id, name, type, verified |
| `drives` | id, org_id, status, location (PostGIS point), start_date, duration_days, expected/actual_participants, goal_lbs, predicted_lbs/low/high, provenance |
| `donation_logs` | drive_id, category, lbs, logged_at, logged_by |
| `inventory_lots` | drive_id, category, lbs, perishable, expires_on |
| `shelters` | id, name, kind, location, storage, turnover_days, contact (+ `contact_public`) |
| `shelter_needs` | shelter_id, category, unit, lbs_per_unit, qty_needed, qty_received, deadline |
| `verifications` | shelter_id, verified_at, method, verified_by |
| `shifts`, `shift_signups` | drive_id, role, date, times, slots / user_id |
| `deliveries` | drive_id, shelter_id, category, lbs, confirmed_by_shelter_at |

Then implement `Repository` with the Supabase client:

```ts
export const supabaseRepository: Repository = { /* load: select drives, shelters…; save: upsert */ };
```

For a multi-user app, replace the reducer's local mutations with async calls (or TanStack Query) and keep the reducer as a client cache.

**Row-level security:** shelter staff can edit only their shelter's needs; organizers only their drives; private shelter addresses are never returned to public clients.

**Verified impact:** a delivery counts as `verified` only when `deliveries.confirmed_by_shelter_at` is set by shelter staff. That's what Impact Analytics would filter on.

### Step 2: Python prediction API (optional)
When the team wants richer models (gradient boosting, weather/holiday features, hierarchical Bayesian), move fitting server-side:

```
POST /forecast   { orgType, participants?, durationDays, month, categories, location, organization? }
→ { median, low, high, sigmaLog, steps[], dataStrength, adjustment }
GET  /model/backtest → { mape, baselineMape, coverage80, bias, points[] }
```

- FastAPI + NumPy/statsmodels. `fitModel` translates directly: `theta = np.linalg.solve(X.T@X + Λ, X.T@y + Λ@θ0)`.
- Keep the **same response shape** as `Forecast` in `forecast.ts`, so the UI components don't change.
- Retrain nightly or on drive completion (database trigger → queue).
- Keep the TypeScript model as an offline fallback and as a regression test: both implementations should agree on the same data.

### Step 3: External data
| Need | Source |
|---|---|
| Road distances / routes | OSRM (self-hosted, free) or Mapbox Directions → replace `roadMiles` |
| Community need layer | USDA Food Access Research Atlas, Feeding America Map the Meal Gap, Census ACS |
| Geocoding addresses | Nominatim (OpenStreetMap) or Mapbox |
| Map tiles | OpenStreetMap tiles are fine for a demo; use a commercial/self-hosted tile provider for real traffic |

### Step 4: Deployment
`npm run build` produces static files in `dist/`. Host on Vercel, Netlify, or GitHub Pages with an SPA fallback (all routes → `index.html`).

## Testing
- `npm test`: Vitest unit tests for linear algebra, haversine, forecast monotonicity/intervals/backtest-beats-baseline, goal probability, urgency bounds, matching constraints (supply, need caps, refrigeration, locks, exclusions), routing, and Holt smoothing.
- `npx tsc --noEmit -p .`: strict type-check.

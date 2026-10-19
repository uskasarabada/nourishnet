# NourishNet: Design System

**Personality:** friendly, trustworthy, intelligent, community-first. Think "a well-made field guide," not "admin dashboard."

## Color

Defined in `tailwind.config.js`.

| Role | Token | Hex | Use |
|---|---|---|---|
| Page background | `cream-100` | `#FBF8F1` | Warm, soft canvas |
| Surface | white | `#FFFFFF` | Cards |
| Subtle surface | `cream-50/200` | `#FFFDF8` / `#F4EFE3` | Inputs, inset panels |
| Primary | `forest-700` | `#145536` | Buttons, active nav, headings accent |
| Primary dark | `forest-900` | `#0C2F1F` | Headlines, dark sections |
| Accent | `forest-500` / `emerald-500` | `#1F8A52` / `#10B981` | Progress, positive change |
| Warning | `amber-500/700` | `#E3A008` / `#8A5F00` | High urgency, goals, "soon" |
| Alert | `coral-500/700` | `#E0663F` / `#9A3B1D` | Critical urgency, expiring food, emergency |
| Ink | `ink-900 … 300` | `#1B2620` … `#A9B0AB` | Text hierarchy (never pure black) |

**Status colors are reserved** for urgency (Critical coral, High amber, Moderate green, Low gray) and always appear with an icon + text label, never color alone.

### Data-visualization palette
Food categories have **fixed** colors (never re-assigned when filters change), in an order validated for color-vision-deficiency separation (adjacent-pair CVD ΔE ≥ 8, normal-vision ΔE ≥ 15):

Grains `#1f8a52` · Protein `#6d5bd0` · Canned veg `#e3a008` · Canned fruit `#2a78d6` · Breakfast `#e0663f` · Baby `#0f9aa3` · Hygiene `#9c5a1c` · Produce `#d65a8f`

Amber has < 3:1 contrast on white, so every chart using categories also has a legend and/or direct labels or a table.

Map markers: active `#1f8a52` (pulsing), upcoming `#2a78d6`, completed `#7D8781`, shelters violet squares, drop-off bins small amber squares.

## Typography
- **Display:** *Fraunces* (soft serif) for headlines and big numbers. Warm and editorial, avoids the "template SaaS" look.
- **Body/UI:** *Plus Jakarta Sans*, 400–700.
- Numbers use `tabular-nums` (`.tabular`) so columns align and animated values don't jitter.
- Eyebrows: 12px, bold, uppercase, 0.14em tracking, forest-600.

## Shape, depth, motion
- Radius: cards `1.25rem`, inputs `0.75rem`, buttons/chips fully rounded.
- Shadows: `shadow-card` (resting), `shadow-lift` (hover/popovers). Soft and low-contrast.
- Motion: `animate-rise` (420ms fade-up) on page headers and panels; progress bars ease over 700ms; pulsing rings mark live things (active drives, critical shelters). All motion is disabled under `prefers-reduced-motion`.

## Components (`src/components/`)
| Component | Purpose |
|---|---|
| `Card`, `CardTitle`, `PageHeader` | Layout primitives |
| `Stat` | KPI tile (optional dark "accent" variant) |
| `ProvenanceBadge` | **Verified / Self-reported / Estimate / Sample data** on every number |
| `UrgencyBadge` | Level + score + stale flag, icon + text |
| `Progress`, `Slider`, `Toggle` | Accessible controls (`role="progressbar"`, labeled range, `role="switch"`) |
| `Callout`, `Empty` | Info/warn/alert notes, empty states |
| `ChartTooltip`, `Legend`, `AXIS`, `GRID` | Consistent Recharts styling |
| `RangeBar`, `ForecastExplanation`, `ResourceCards`, `CategoryMix`, `DataStrength` | Forecast visuals |
| `MapBase`, `pinIcon` | Leaflet wrapper with fly-to and fit-bounds |
| `.btn-primary/secondary/ghost`, `.chip-on/off`, `.input`, `.label` | CSS component classes in `index.css` |

## Chart rules
- One y-axis per chart (never dual-axis). Thin 2px lines, 4px rounded bar ends, 2px white gaps between stacked segments.
- Uncertainty is always drawn (shaded bands), never hidden.
- Every chart has hover tooltips; ≥ 2 series always have a legend.
- Recessive grid (`#EDE7DA`, horizontal only) and muted axes.

## Accessibility checklist
- Skip-to-content link; visible focus rings (`ring-forest-500`).
- Text contrast ≥ 4.5:1 for body (ink-500 on cream passes for 13px+).
- All toggles/chips expose `aria-pressed`; switches use `role="switch"`.
- Form fields have labels; errors use `role="alert"`; donation logging announces via `aria-live`.
- Information never conveyed by color alone (icons + text on statuses, legends on charts).
- Responsive from 360px; nav collapses to a menu below 1024px.

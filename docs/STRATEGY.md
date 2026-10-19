# NourishNet: Product Strategy

> Predict Needs. Connect Communities. Fight Hunger.

This document covers the strategic deliverables: naming, concept refinement, MVP scope, user experience, original innovations, and the 3-minute demo plan. See also [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [ALGORITHMS.md](ALGORITHMS.md), and [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. Three name options

| Name | Why it works | Risk |
|---|---|---|
| **NourishNet** ⭐ *preferred* | "Nourish" is warm and human; "Net" says *network* (connecting drives, shelters, volunteers) and *safety net*. Easy to say in a demo, memorable for judges. | Generic-sounding names exist; check app-store/domain availability. |
| **Provision** | Double meaning: "to provide food" and "foresight / planning ahead," which is exactly the forecasting angle. Sounds like a real startup. | Less obviously about food on first hearing. |
| **FullPlate** | Instantly understood, friendly, great for a student-led brand. | Feels more like a consumer meal app than a planning tool. |

**Recommendation: keep NourishNet.** It already fits the tagline, and "Net" lets you tell the story of a *network* with predictions flowing through it.

---

## 2. How to strengthen the concept

1. **Lead with one sharp problem.** Judges remember one sentence: *"Food drives guess. NourishNet predicts, so every can goes where it's needed."* Everything else supports that.
2. **Close the loop: plan → collect → match → deliver → learn.** Most food-drive apps stop at "list events." NourishNet's differentiator is that **every completed drive retrains the forecast**. The app gets smarter as communities use it. (Implemented: closing a drive re-fits the model live.)
3. **Make trust a feature.** Food assistance involves vulnerable people. Every number carries a provenance label (Verified / Self-reported / Estimate / Sample), urgency scores are published formulas, and shelter addresses can be withheld (see the Maple Heights Women & Children Shelter in the demo).
4. **Honest uncertainty over false precision.** Show *ranges* and "Limited history" warnings. Judges with technical backgrounds will respect this more than a single confident number.
5. **Fairness by design.** Leaderboards normalize by participant count so small schools aren't disadvantaged, and the coverage-gap map points drives toward under-served neighborhoods rather than the ones that already give the most.
6. **Shelters first, not donors first.** Donation matching works from *verified requests*, so shelters get what they asked for (formula, protein, produce) instead of what was easiest to give.

---

## 3. Five most important MVP features (competition-ready)

| # | Feature | Why it's in the MVP | Status in prototype |
|---|---|---|---|
| 1 | **Collection forecast + what-if simulator** | The centerpiece and the clearest technical contribution. | ✅ Regression, 80% interval, waterfall explanation, goal probability, backtest |
| 2 | **Resource plan** (volunteers, boxes, storage, vehicles, meals, food mix) | Turns a number into something an organizer can act on. | ✅ |
| 3 | **Verified shelter needs + transparent urgency** | Provides the "demand" side that the forecast and matching depend on. | ✅ With 6-week shortage forecast |
| 4 | **Smart donation matching with explanations** | Shows real algorithmic problem-solving and closes the loop. | ✅ Constrained allocator, locks, exclusions, route plan |
| 5 | **Interactive map of past/active/upcoming drives** | Visually impressive, makes history tangible, hosts the coverage-gap insight. | ✅ |

Everything else (volunteer matching, challenges, emergency mode, impact reports) is built but secondary. If time is short in the demo, cut those first.

---

## 4. User experience & navigation

### Personas and their primary journeys

| Persona | Goal | Journey through the app |
|---|---|---|
| **Organizer** (student council, club, nonprofit) | Run a successful drive | Landing → **Predict** → **Create** (4 steps) → Drive page (share link, log donations) → **Match** → Report |
| **Volunteer / donor** | Help nearby, on their schedule | Landing → **Map** or **Volunteer** → Drive page → Sign up → **Profile** |
| **Shelter staff** | Get what they need | **Shelter Needs** → re-verify request → receive matched deliveries |

### Information architecture

```
/                      Landing (hero + live forecast preview)
├── /dashboard         Main dashboard: active drives, upcoming forecasts, urgent needs, shortages, expiring food
├── /map               Food Drive Map: filters, layers, coverage gaps, drive detail panel
├── /predict           Prediction Center: inputs, what-if, resource plan, model transparency (#how)
├── /shelters          Shelter Needs: search, map, profile, urgency breakdown, 6-week forecast (#urgency)
├── /match?drive=      Smart Matching: allocation, reasons, adjust, routes, waste alerts (#how)
├── /impact            Impact Analytics: KPIs, timeline (brush zoom), challenges, milestones
├── /volunteer         Volunteer Matching
├── /profile           User Profile
├── /create            Create a Food Drive (multi-step)
└── /drives/:id        Food Drive Details
    └── /report        Printable Impact Report
```

**Global elements:** sticky top nav (collapses to a menu on mobile), an **Emergency** toggle that filters the whole app to verified urgent requests, a primary **New drive** button, a profile avatar, and a persistent demo-data banner with **Reset demo**.

**UX principles applied**
- Every screen answers "what should I do next?" with one primary button.
- Every algorithm has a "How it works" anchor reachable from the footer.
- No dead buttons. Every control changes state, navigates, or computes.
- Keyboard: skip link, visible focus rings, `aria-pressed` on toggles/chips, `role="switch"`, `role="progressbar"`, `aria-live` for donation logging.

---

## 9. Three original innovations that would genuinely distinguish the entry

1. **A forecast that learns from the community: "every drive makes the next one smarter."**
   Forecasts are saved at creation and scored when the drive closes. The model retrains immediately, and the Prediction Center shows a *learning curve* (error vs. amount of history) plus a rolling backtest against a rule-of-thumb baseline. Few student projects (or real nonprofits) measure their own prediction accuracy. **Demo it live:** close out a drive and watch the training count increase.

2. **Coverage-gap targeting: "where *should* the next drive be?"**
   A kernel-density comparison of documented need vs. historical drive activity highlights neighborhoods that are under-served *relative to need*. In production, the need layer comes from public data (USDA Food Access Research Atlas, Feeding America Map the Meal Gap). This flips the usual question from "where can we collect?" to "where is food missing?"

3. **Explainable, adjustable allocation: "the algorithm proposes, people decide."**
   Every recommended pound comes with plain-English reasons (urgency factors, % of request filled, distance, refrigeration/expiry safety). Organizers drag a slider to override any allocation; the algorithm locks that choice and re-optimizes everything else. Pair it with **expiry-aware routing** so perishable lots go to kitchens that will cook them within days, reducing waste.

*Stretch ideas:* SMS-based shelter verification (one-tap "still need this?"), a barcode scan → category/weight estimate for donation logging, and multi-drive pooling (two small drives combine deliveries).

---

## 10. Three-minute demonstration plan

| Time | Segment | What's on screen | What you say (summary) |
|---|---|---|---|
| **0:00–0:25** | **Problem** | Landing hero → "The problem" section | "Food drives run on guesswork. Organizers don't know how many boxes or volunteers they'll need, and shelters get what was easy to donate, not what they asked for." |
| **0:25–1:15** | **Predict** (the core) | Prediction Center. Change org type and month, then drag the **participants** and **event length** sliders. Point to the range, chance-of-goal, and the 5-step explanation. Scroll to resource plan. | "This is a regression model we wrote ourselves. Each step is a multiplier you can read. It gives a *range*, not a fake exact number, and turns it into volunteers, boxes, and vehicles." |
| **1:15–1:40** | **Proof it works** | Scroll to *How the forecast works*: MAPE vs. baseline, predicted-vs-actual scatter, learning curve | "We test every past drive using only the drives *before* it. Our error is about 20% vs 73% for the usual rule of thumb, and the 80% range catches about 80% of outcomes." |
| **1:40–2:15** | **Match & deliver** | Shelter Needs (click St. Brigid's → urgency breakdown + shortage forecast) → Smart Matching for the active drive. Drag one slider to lock; show reasons; show route map & savings; show expiring-produce alert. | "Urgency is a published formula, not AI magic. The matcher splits food across verified requests, explains every choice, and respects storage and expiration. Organizers stay in control." |
| **2:15–2:40** | **The loop closes** | Drive page → log a donation → **Close out drive** → back to Prediction Center: trained-on count increments | "When a drive ends, its real results retrain the model, so the next forecast is better." |
| **2:40–3:00** | **Impact & close** | Map with coverage-gap layer → Impact page (fair leaderboard) | "We also show *where* drives are missing. Everything you saw is working code, with clearly labeled sample data. NourishNet: predict needs, connect communities, fight hunger." |

**Demo tips**
- Click **Reset demo** right before recording so the state is clean.
- Record at 1440×900 in a browser with the bookmarks bar hidden.
- Have one teammate narrate and another drive the mouse. Rehearse transitions.
- Briefly show the code (e.g. `src/lib/forecast.ts` `fitModel`) for ~5 seconds during the "proof" segment. Judges look for *your* code.

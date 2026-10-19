# AI Assistance Disclosure

The Congressional App Challenge expects students to build their own apps. Be transparent about any tools you used, and check the **current year's official rules** (congressionalappchallenge.us) for their exact policy on AI-generated code.

## What was AI-generated

This initial prototype was generated with **Claude (Anthropic) via Claude Code** from the team's written product brief, including:

- The project scaffold, all React/TypeScript screens, and the component library
- The algorithms in `src/lib/` (forecast regression, matching, routing, urgency, Holt smoothing, coverage grid)
- The synthetic demo data generator (`src/data/seed.ts`)
- The documents in `docs/` and this README

## What the team should do before submitting

To make this genuinely *your* project, and to answer judges' questions confidently:

1. **Understand every algorithm.** Be able to explain `fitModel`, the prediction interval, the backtest, the matching score, and 2-opt without notes. `docs/ALGORITHMS.md` is your study guide.
2. **Rewrite and extend substantial parts yourselves.** Good candidates: re-implement the regression or matching from scratch, add a new feature (e.g. SMS verification, barcode logging), replace synthetic data with data from a real local partner, and tune the design.
3. **Keep a log of your own changes.** Use git commits under your own names and note in this file which parts you wrote, rewrote, or changed.
4. **Get real data where you can.** Even a few real past drives from your school make the demo far more credible. Label them `verified` only when confirmed.
5. **Keep this disclosure up to date** and mention it in your submission if the rules require it.

## Team contribution log

| Date | Who | What |
|---|---|---|
| | | |

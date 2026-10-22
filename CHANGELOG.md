# Changelog

## 2.1.0 — 2026-10-22

- Add a free Turkish local interpreter with deterministic, scoped explanations and no language model, API call or model download.
- Explain investigation priorities, TTFB, HTTP errors, large transfers, cache metadata, budgets, privacy and baseline changes; include clickable request evidence and follow-up questions.
- Keep 12 conversation turns in memory; clear stale context when captures, scopes, baselines or profiles change.
- Add Paper, Forest and Midnight themes plus automatic system preference, storing only the theme name locally.
- Bundle the Manrope variable font and its SIL OFL license without runtime font CDNs.
- Add staggered entrances, chart reveals, conversation transitions and responsive chat, respecting reduced-motion preferences.
- Support direct assistant links with `?view=assistant` and keyboard shortcut 6.


## 2.0.0 — 2026-10-22

- Add a network overview with concurrency, active/idle time, domain transfer, resource types and phase breakdowns.
- Add independently scoped current/baseline HAR pages with recomputed metrics and exports.
- Add advanced search with AND, quoted terms, negation, numeric comparisons and time/size units.
- Add editable performance budgets and finding/comparison thresholds, plus portable JSON profiles.
- Add standalone passive HTML reports with SVG charts and print styles, plus formula-escaped CSV exports.
- Add direct JSON import for captures, baselines and profiles; reject invalid imports without losing the active capture.
- Add comparison search and state filters, newly failing endpoints, known transfer deltas and request drill-down.
- Bound waterfall rendering to 100 requests per page.
- Extend the CLI with HTML/CSV formats, configuration enforcement, page selection and query filtering.
- Keep zero runtime dependencies and in-memory browser processing.
- Deploy browser/engine changes on main automatically after the deployment workflow's tests pass.

## 1.0.0 — 2026-10-22

- Initial HAR waterfall, deterministic findings, endpoint median comparison, sanitizer, Markdown reports and Node.js CLI.
- Add GitHub Pages deployment and Linux/Windows CI for Node.js 22 and 24.

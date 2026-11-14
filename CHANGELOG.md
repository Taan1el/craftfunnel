# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.2] - 2026-11-14

### Fixed
- Funnel steps that share a timestamp are no longer dropped: events with equal timestamps are ordered by their row in the file, and a note appears when every timestamp is a date.
- The timestamp parser also accepts fractional seconds of 1 to 9 digits, offsets written as +00, +0200 and +02:00, times without seconds, and Unix epoch seconds or milliseconds. Ambiguous formats such as 01/02/2024 are still rejected, and the message lists what is accepted.
- Imports skip bad rows instead of rejecting the whole file, report how many rows were imported and skipped with the first reasons and real file line numbers, and fail only when no row is valid or more than half are not.
- Reconciliation sums amounts per ID and currency on each side and compares net totals, so a charge plus a refund or split payments net out. Exact repeated rows are reported separately as duplicates.
- The currency column is optional with a default currency, ID matching ignores case by default, and comma, semicolon or tab delimiters are detected from the header.
- P-values below 0.0001 are shown as "p < 0.0001" instead of 0.0000, and negative amounts in the discrepancy CSV are written as numbers instead of text with a leading apostrophe.
- Importing a workspace backup now asks for confirmation and states how many rows will be replaced.
- A new version of the offline app reaches users: pages load from the network first with the cached copy as the offline fallback, the update is precached without the HTTP cache, and a "A new version is ready." notice offers a Reload button.
- Downloaded files keep their link alive for one second before it is released.
- A browser storage message named the wrong app.

## [Unreleased]

### Fixed
- The payment ledger, customers and customer drawer tables can now be scrolled sideways with the keyboard on narrow screens, with a visible focus outline.

### Added
- A test that checks every scrollable table wrapper is a labelled, focusable region.
- Automated accessibility checks (WCAG 2 A and AA, using axe) for the funnel view, the Experiments, Billing and Customers tabs, and the customer drawer. Color contrast is verified separately because jsdom cannot compute colors.

### Changed
- New visual identity: pure white pages with a single raspberry accent, Red Hat Display, Red Hat Text and Azeret Mono type, and 12px rounded bars and controls.
- The acquisition funnel is now the hero of the page, drawn as full-width stage bars with a drop-off chip between stages. The key metrics are one line of large numerals above it instead of a strip.
- Experiments, Billing and Customers moved into underline tabs below the funnel. The webhook form is a single row above the payment ledger, and experiment variants show a small conversion-rate bar.
- Every control is at least 44px tall at phone width, including the demo bar links and the refresh checkbox.

## [1.0.0] - 2026-09-15

### Added
- Express API modeling an acquisition funnel, deterministic hash-based A/B experiment allocation, and Stripe-style webhook reconciliation with a payment ledger, backed by Node's native SQLite (`node:sqlite`, WAL mode).
- React 19 dashboard: a flat funnel visualizer, a dense A/B experiment list with a live variant-bucket tester, a webhook simulator, a payment ledger table, and a customer lifecycle drawer, in a light-paper, single-accent visual style with self-hosted Sora/Geist/Geist Mono fonts and `lucide-react` icons.
- In-browser demo mode for GitHub Pages: the same funnel and experiment math (`shared/`) runs against fixed seed data with no backend, with a banner explaining that and a "Reset demo data" control.
- Docker image (multi-stage build) and a Compose file; the API container also serves the built dashboard.
- CI workflow (Node 22.x/24.x matrix: lint, test, build, and the GitHub Pages build; plus a Docker build) and a GitHub Pages deployment workflow.
- Server tests for every route and its edge cases, pure-logic unit tests for the shared funnel and significance math, and client tests including a dedicated demo-adapter suite.

### Fixed
- The significance test's reported confidence used a one-tailed distribution while the "statistically significant" flag used a two-tailed threshold, so a result could flip to significant a couple of points before its own confidence figure reached 95%.
- An empty funnel, or a growth-metrics query with no visits, divided by a denominator quietly substituted with 1, producing a percentage instead of correctly reporting no data.
- A Stripe webhook naming no resolvable customer was attributed to an arbitrary existing customer instead of being left unhandled.
- A webhook amount of exactly 0 was treated as missing and silently replaced with the default of 9900 cents.
- The compiled server's `start` script and the Docker image's entry point pointed at `server/dist/index.js`, which never existed after a real build (the actual output is `server/dist/server/src/index.js`); both crashed immediately after `npm run build`.
- The API container never served the built client, despite the README and Compose file describing one unified container.
- Error responses sent the raw error message to the client, which could leak internal detail; unexpected errors now log server-side and return a generic message.
- Funnel stage, experiment, and webhook request bodies were not validated against known values.
- `.gitignore`'s database patterns were anchored to the repo root, so they never actually matched the server's real `server/data/craftfunnel.db` path.
- `server/package.json` and `client/package.json` were missing the `repository`, `homepage`, and `bugs` fields already present at the root.

# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

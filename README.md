# CraftFunnel 📈

> **SaaS Growth Engine, Deterministic A/B Allocator & Stripe Payment Reconciliation Platform**  
> Built with React 19, TypeScript, Node.js, Express, Relational SQLite (WAL Mode), Docker, and Vitest.

[![CI Pipeline](https://github.com/Taan1el/craftfunnel/actions/workflows/ci.yml/badge.svg)](https://github.com/Taan1el/craftfunnel/actions)
![Node Version](https://img.shields.io/badge/node-%3E%3D24.0.0-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.8-blue)
![Tests](https://img.shields.io/badge/tests-16%20passing-brightgreen)

---

## 2-Minute Evaluation Summary

CraftFunnel is a production-grade full-stack growth engineering platform designed to model modern SaaS experimentation, customer lifecycle tracking, and financial payment reconciliation.

### Key Capabilities & Job Requirement Mapping:
1. **Deterministic A/B Testing & Statistical Significance**:
   - Deterministic variant allocation via `SHA256(userId + ":" + experimentKey) % 100` mapped against configurable variant weights. Guarantees consistent user experience across sessions without persistent database lookups.
   - Real-time 2-proportion **Z-score** calculation with normal cumulative distribution approximation reporting statistical confidence levels ($\ge 95\%$ winner determination).
   - Live interactive visitor bucket evaluator and conversion tracker.
2. **Stripe Webhook Reconciliation & Financial Ledger**:
   - Ingestion of external Stripe events (`payment_intent.succeeded`, `invoice.payment_failed`, `charge.refunded`).
   - Strict idempotency protection: duplicate Stripe event IDs (`evt_...`) are safely recognized and skipped to eliminate duplicate charges or corrupt MRR numbers.
   - Reconciled double-entry financial transaction ledger with audit status (`settled`, `failed`, `refunded`).
3. **Acquisition Funnel Analytics**:
   - Full customer lifecycle progression: `visited` &rarr; `onboarded` &rarr; `activated` &rarr; `trial_started` &rarr; `converted_paid`.
   - Automated drop-off calculation detecting highest-friction bottleneck stages to guide growth experiments.
4. **Customer Profile & Lifecycle Inspector**:
   - Slide-out customer detail drawer displaying assigned experiment buckets, chronological funnel event milestones, and reconciled billing transactions.
5. **Engineering Standards & DevOps**:
   - 16 automated integration and component tests (`vitest`, `supertest`, React Testing Library).
   - Multi-stage `Dockerfile` and `docker-compose.yml`.
   - GitHub Actions CI pipeline running typechecking, tests, and production build.
   - 3 Architecture Decision Records (`docs/adr/`).

---

## Architecture Diagram

```
                       +-----------------------------------+
                       |    React 19 Dashboard (Vite)     |
                       |  - Growth Metrics & Funnel Chart |
                       |  - A/B Experiments & Z-Score     |
                       |  - Stripe Webhook Simulator      |
                       |  - Customer Lifecycle Drawer     |
                       +-----------------+-----------------+
                                         | REST / JSON
                                         v
+-------------------------------------------------------------------------+
|                         CraftFunnel Node.js Service                     |
|                                                                         |
|  +------------------------+             +----------------------------+  |
|  |  Experiment Engine     |             |  Stripe Webhook Handler    |  |
|  | - Deterministic Hash   |             | - Idempotency guard        |  |
|  | - Variant allocation   |             | - Status & MRR updates     |  |
|  | - Z-Score & Confidence |             | - Double-entry ledger      |  |
|  +-----------+------------+             +--------------+-------------+  |
|              |                                         |                |
|              +-------------------+   +-----------------+                |
|                                  v   v                                  |
|                 +--------------------------------+                      |
|                 |   Relational Database (SQLite) |                      |
|                 |   - experiments & variants     |                      |
|                 |   - customers & funnel_events  |                      |
|                 |   - payment_ledger & webhooks  |                      |
|                 +--------------------------------+                      |
+-------------------------------------------------------------------------+
```

---

## Quickstart (Zero External Dependencies)

### 1. Local Development
Requirements: Node.js 24+ (npm).

```bash
# Clone the repository
git clone https://github.com/Taan1el/craftfunnel.git
cd craftfunnel

# Install workspace dependencies
npm install

# Run automated tests (16 passed)
npm test

# Typecheck and lint
npm run lint

# Start server (port 4000) and client (port 5173) concurrently
npm run dev
```

Visit **http://localhost:5173** to view the live dashboard!

### 2. Run via Docker Compose

```bash
docker compose up --build
```
This builds and starts the unified production container on `http://localhost:4000`.

---

## REST API Specification

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health status and uptime |
| `GET` | `/api/payments/metrics` | Growth metrics: MRR, Active Subscribers, Funnel Conversion, ARPU |
| `GET` | `/api/experiments` | List experiments with variants, conversion rates, and Z-scores |
| `POST` | `/api/experiments/evaluate` | Deterministically assign a user to an experiment variant |
| `POST` | `/api/experiments/convert` | Record conversion for a user within an experiment |
| `GET` | `/api/funnel/metrics` | Step-by-step funnel counts, conversion rates, and drop-offs |
| `POST` | `/api/funnel/track` | Track custom customer lifecycle milestone event |
| `POST` | `/api/payments/webhook` | Ingest external Stripe payment webhook event |
| `POST` | `/api/payments/simulate` | Interactive simulation endpoint for Stripe webhooks |
| `GET` | `/api/payments/ledger` | Chronological audit log of reconciled payment transactions |
| `GET` | `/api/customers` | Customer directory with MRR and lifecycle statuses |
| `GET` | `/api/customers/:id` | Detailed customer profile |
| `GET` | `/api/customers/:id/timeline` | Customer audit history: funnel events, experiment buckets, ledger |

---

## Architecture Decision Records (ADRs)

1. [ADR-001: Deterministic Hash-Based Experiment Allocation](docs/adr/ADR-001-deterministic-hash-based-experiment-allocation.md)
2. [ADR-002: Idempotent Payment Webhook Reconciliation](docs/adr/ADR-002-idempotent-payment-webhook-reconciliation.md)
3. [ADR-003: Funnel Step Conversion Aggregations](docs/adr/ADR-003-funnel-step-conversion-aggregations.md)

---

## License
MIT

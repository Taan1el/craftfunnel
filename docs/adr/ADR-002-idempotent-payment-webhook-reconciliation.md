# ADR-002: Idempotent Payment Webhook Reconciliation & Financial Ledger

## Status
Accepted

## Context
Payment gateways such as Stripe, Adyen, and PayPal operate under "at-least-once" delivery semantics for webhooks. In the event of network hiccups or latency, identical webhook events (`payment_intent.succeeded`, `invoice.payment_failed`, `charge.refunded`) will be retried multiple times. Without strict idempotency guards, systems suffer from:
- Duplicate subscription upgrades.
- Erroneous double-charging or multiple credit allocations.
- Corrupted financial reporting and inaccurate MRR calculations.

## Decision
1. **Idempotency Guard via Unique Event Tracking**:
   Every incoming webhook's unique identifier (`event.id`, e.g. `evt_...`) is checked against `processed_webhooks`. If previously reconciled, the server immediately returns HTTP 200 with `{ duplicate: true }`, bypassing any database mutations.
2. **Double-Entry Financial Ledger**:
   Successful payments, failures, and refunds are logged into `payment_ledger` with currency, amount in cents, status, invoice ID, and customer foreign keys.
3. **Atomic State & MRR Transitions**:
   Upon `payment_intent.succeeded`, the customer status is transitioned to `active`, their MRR is incremented, and a `converted_paid` funnel event is tracked atomically.
   Upon `charge.refunded`, a negative ledger entry is recorded, and MRR is deducted.

## Consequences
- 100% protection against duplicate webhook processing.
- Clean, traceable audit journal of all financial movements.
- Reliable MRR and ARPU calculations reflecting real settled balances.

import React, { useEffect, useState } from 'react';
import type { Customer } from '../../../shared/types';
import { api } from '../services/index.js';

interface WebhookSimulatorProps {
  customers: Customer[];
  onReconciliationComplete: () => void;
}

export const WebhookSimulator: React.FC<WebhookSimulatorProps> = ({
  customers,
  onReconciliationComplete,
}) => {
  const [eventType, setEventType] = useState('payment_intent.succeeded');
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  // Kept as a string (rather than a number) so the field can actually go
  // empty or hold a stray "-" while typing; a numeric-typed state snaps ''
  // back to 0, which the input's own min="1" then blocks at the browser
  // level before this component's onSubmit ever runs, so the validation
  // message below would never have a chance to appear.
  const [amountEurInput, setAmountEurInput] = useState('99');
  const [idempotencyKey, setIdempotencyKey] = useState(`evt_stripe_${Math.random().toString(36).substring(2, 9)}`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // customers loads asynchronously after this component can already be
  // mounted, so the id picked at first render is often ''; adopt the first
  // customer once the list arrives instead of leaving the select stuck on a
  // value that matches no option.
  useEffect(() => {
    if (!customerId && customers.length > 0) {
      setCustomerId(customers[0].id);
    }
  }, [customers, customerId]);

  const handleGenerateKey = () => {
    setIdempotencyKey(`evt_stripe_${Math.random().toString(36).substring(2, 9)}`);
    setResult(null);
  };

  const handleSendWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setValidationError(null);

    if (!customerId) {
      setValidationError('Select a customer before firing a webhook.');
      return;
    }
    const amountEur = Number(amountEurInput);
    if (amountEurInput.trim().length === 0 || !Number.isFinite(amountEur) || amountEur <= 0) {
      setValidationError('Amount must be a positive number.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.simulateWebhook({
        event_type: eventType,
        customer_id: customerId,
        amount_cents: Math.round(amountEur * 100),
        idempotency_key: idempotencyKey,
      });

      if (res.duplicate) {
        setResult(
          `⚠️ Idempotency Guard Triggered: Stripe Event ID '${idempotencyKey}' was previously reconciled. Skipping ledger update to prevent duplicate charges.`
        );
      } else {
        setResult(
          `✅ Successfully reconciled Stripe webhook '${eventType}'! Ledger Entry #${res.ledger?.id.substring(0, 8)} recorded with status '${res.ledger?.status}'.`
        );
      }
      onReconciliationComplete();
    } catch (err: any) {
      setResult(`Webhook failure: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="webhook-sim-card">
      <div className="sim-header">
        <h3 className="sim-heading">Stripe Webhook & Financial Reconciliation Simulator</h3>
        <p className="sim-sub">
          Test real-time webhook ingestion, double-entry ledger settlement, and idempotency deduplication.
        </p>
      </div>

      {customers.length === 0 ? (
        <p className="empty-subtext">No customers yet, so there is nothing to bill. Customers appear here once seeded.</p>
      ) : (
        <form onSubmit={handleSendWebhook} className="sim-form">
          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="sim-event-type">Stripe Event Type</label>
              <select
                id="sim-event-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="form-input"
              >
                <option value="payment_intent.succeeded">💳 payment_intent.succeeded (Settled)</option>
                <option value="invoice.payment_failed">❌ invoice.payment_failed (Failed)</option>
                <option value="charge.refunded">↩️ charge.refunded (Reversed)</option>
              </select>
            </div>

            <div className="form-group flex-1">
              <label htmlFor="sim-customer">Customer</label>
              <select
                id="sim-customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="form-input"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}) - {c.status.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group flex-sm">
              <label htmlFor="sim-amount">Amount (EUR)</label>
              <input
                id="sim-amount"
                type="number"
                min="1"
                max="5000"
                step="1"
                value={amountEurInput}
                onChange={(e) => setAmountEurInput(e.target.value)}
                className="form-input"
                aria-invalid={validationError ? true : undefined}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <div className="label-with-action">
                <label htmlFor="sim-idempotency">Stripe Event ID (Idempotency Key)</label>
                <button type="button" className="link-btn" onClick={handleGenerateKey}>
                  🎲 New ID
                </button>
              </div>
              <input
                id="sim-idempotency"
                type="text"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                className="form-input font-mono"
              />
            </div>

            <div className="form-group flex-actions">
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Reconciling...' : '⚡ Fire Stripe Webhook'}
              </button>
            </div>
          </div>

          {validationError && (
            <div className="alert-box alert-warning" role="alert">
              {validationError}
            </div>
          )}

          {result && (
            <div
              className={`alert-box ${result.startsWith('✅') ? 'alert-success' : 'alert-warning'}`}
              role="status"
            >
              {result}
            </div>
          )}
        </form>
      )}
    </div>
  );
};

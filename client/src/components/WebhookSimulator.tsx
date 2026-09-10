import React, { useState } from 'react';
import type { Customer } from '../../../shared/types';
import { api } from '../services/api';

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
  const [amountEur, setAmountEur] = useState(99);
  const [idempotencyKey, setIdempotencyKey] = useState(`evt_stripe_${Math.random().toString(36).substring(2, 9)}`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleGenerateKey = () => {
    setIdempotencyKey(`evt_stripe_${Math.random().toString(36).substring(2, 9)}`);
    setResult(null);
  };

  const handleSendWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await api.simulateWebhook({
        event_type: eventType,
        customer_id: customerId || customers[0]?.id,
        amount_cents: amountEur * 100,
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
              value={amountEur}
              onChange={(e) => setAmountEur(Number(e.target.value))}
              className="form-input"
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

        {result && (
          <div
            className={`alert-box ${result.startsWith('✅') ? 'alert-success' : 'alert-warning'}`}
          >
            {result}
          </div>
        )}
      </form>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Dices } from 'lucide-react';
import type { Customer } from '../../../shared/types';
import { api } from '../services/index.js';

interface WebhookSimulatorProps {
  customers: Customer[];
  onReconciliationComplete: () => void;
}

export const WebhookSimulator: React.FC<WebhookSimulatorProps> = ({ customers, onReconciliationComplete }) => {
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
  const [result, setResult] = useState<{ message: string; tone: 'success' | 'warn' } | null>(null);
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
        setResult({
          tone: 'warn',
          message: `Stripe event "${idempotencyKey}" was already reconciled, so this retry was skipped.`,
        });
      } else {
        setResult({
          tone: 'success',
          message: `Successfully reconciled "${eventType}". Ledger entry ${res.ledger?.id.substring(0, 8)} recorded as ${res.ledger?.status}.`,
        });
      }
      onReconciliationComplete();
    } catch (err) {
      setResult({ tone: 'warn', message: `Webhook failure: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-column">
      <h3 className="form-column-title">Fire a Stripe webhook</h3>
      <p className="form-column-description">
        Sends a Stripe-shaped event to the reconciliation endpoint and records it in the ledger.
      </p>

      {customers.length === 0 ? (
        <p className="empty-note">No customers yet, so there is nothing to bill.</p>
      ) : (
        <form onSubmit={handleSendWebhook}>
          <div className="field">
            <label className="field-label" htmlFor="sim-event-type">
              Event type
            </label>
            <select id="sim-event-type" value={eventType} onChange={(e) => setEventType(e.target.value)} className="form-input">
              <option value="payment_intent.succeeded">payment_intent.succeeded</option>
              <option value="invoice.payment_failed">invoice.payment_failed</option>
              <option value="charge.refunded">charge.refunded</option>
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="sim-customer">
              Customer
            </label>
            <select id="sim-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="form-input">
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="sim-amount">
              Amount (EUR)
            </label>
            <input
              id="sim-amount"
              type="number"
              min="1"
              max="5000"
              step="1"
              value={amountEurInput}
              onChange={(e) => setAmountEurInput(e.target.value)}
              className="form-input mono"
              aria-invalid={validationError ? true : undefined}
            />
          </div>

          <div className="field">
            <div className="field-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className="field-label" htmlFor="sim-idempotency">
                Stripe event id
              </label>
            </div>
            <div className="field-row">
              <input
                id="sim-idempotency"
                type="text"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                className="form-input mono"
              />
              <button type="button" className="btn btn-secondary" onClick={handleGenerateKey} title="Generate a new event id">
                <Dices size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Reconciling' : 'Fire Stripe webhook'}
            </button>
          </div>

          {validationError && (
            <div className="result-note is-error" role="alert">
              {validationError}
            </div>
          )}

          {result && (
            <div className={`result-note ${result.tone === 'success' ? 'is-success' : ''}`} role="status">
              {result.message}
            </div>
          )}
        </form>
      )}
    </div>
  );
};

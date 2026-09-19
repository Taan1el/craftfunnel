import React from 'react';
import type { PaymentLedgerEntry } from '../../../shared/types';

interface LedgerTableProps {
  entries: PaymentLedgerEntry[];
}

const statusTone: Record<PaymentLedgerEntry['status'], 'ok' | 'warn' | 'bad'> = {
  settled: 'ok',
  refunded: 'warn',
  failed: 'bad',
};

export const LedgerTable: React.FC<LedgerTableProps> = ({ entries }) => {
  return (
    <div className="billing-results">
      <div className="section-header">
        <h2 className="section-heading">Payment ledger</h2>
        <p className="section-description">Reconciled webhook events, newest first.</p>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Customer</th>
              <th>Event id</th>
              <th>Event type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  No payment ledger entries yet. Fire a test webhook to reconcile one.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const amountFormatted = (Math.abs(entry.amount_cents) / 100).toFixed(2);
                const isNegative = entry.amount_cents < 0;

                return (
                  <tr key={entry.id}>
                    <td className="mono" style={{ fontSize: 13 }}>
                      {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td>{entry.customer_email || entry.customer_id}</td>
                    <td className="mono" style={{ fontSize: 13 }}>
                      {entry.stripe_event_id}
                    </td>
                    <td className="mono" style={{ fontSize: 13 }}>
                      {entry.event_type}
                    </td>
                    <td className={`amount-cell ${isNegative ? 'is-negative' : 'is-positive'}`}>
                      {isNegative ? `-€${amountFormatted}` : `+€${amountFormatted}`}
                    </td>
                    <td>
                      <span className="badge">
                        <span className={`status-dot ${statusTone[entry.status]}`} aria-hidden="true" />
                        {entry.status}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                      {entry.invoice_id || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

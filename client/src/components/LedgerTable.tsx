import React from 'react';
import type { PaymentLedgerEntry } from '../../../shared/types';

interface LedgerTableProps {
  entries: PaymentLedgerEntry[];
}

export const LedgerTable: React.FC<LedgerTableProps> = ({ entries }) => {
  return (
    <div className="ledger-section">
      <div className="section-header">
        <div>
          <h3 className="section-heading">Financial Transaction Ledger</h3>
          <p className="section-subheading">
            Double-entry reconciled journal of webhook events processed through payment providers.
          </p>
        </div>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Customer</th>
              <th>Stripe Event ID</th>
              <th>Event Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  No payment ledger transactions recorded yet. Fire a test webhook above to reconcile!
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const amountFormatted = (Math.abs(entry.amount_cents) / 100).toFixed(2);
                const isNegative = entry.amount_cents < 0;

                return (
                  <tr key={entry.id}>
                    <td className="text-xs text-muted">
                      {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td>
                      <span className="customer-email-cell">{entry.customer_email || entry.customer_id}</span>
                    </td>
                    <td>
                      <code className="font-mono text-xs">{entry.stripe_event_id}</code>
                    </td>
                    <td>
                      <span className="event-pill">{entry.event_type}</span>
                    </td>
                    <td>
                      <strong className={isNegative ? 'text-danger' : 'text-success'}>
                        {isNegative ? `-€${amountFormatted}` : `+€${amountFormatted}`}
                      </strong>
                    </td>
                    <td>
                      <span className={`badge badge-${entry.status}`}>
                        {entry.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-xs text-muted font-mono">
                      {entry.invoice_id || '--'}
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

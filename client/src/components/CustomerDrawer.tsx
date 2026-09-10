import React, { useEffect, useState } from 'react';
import type { Customer } from '../../../shared/types';
import { api } from '../services/api';

interface CustomerDrawerProps {
  customer: Customer | null;
  onClose: () => void;
}

export const CustomerDrawer: React.FC<CustomerDrawerProps> = ({ customer, onClose }) => {
  const [timeline, setTimeline] = useState<{ events: any[]; allocations: any[]; ledger: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) {
      setTimeline(null);
      return;
    }

    setLoading(true);
    api
      .getCustomerTimeline(customer.id)
      .then(setTimeline)
      .catch((err) => console.error('Failed to load customer timeline:', err))
      .finally(() => setLoading(false));
  }, [customer]);

  if (!customer) return null;

  return (
    <div className="drawer-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span className="drawer-pretitle">Customer Profile & Lifecycle</span>
            <h2 id="drawer-title" className="drawer-title">{customer.name}</h2>
            <span className="text-xs text-muted font-mono">{customer.email}</span>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close profile drawer">✕</button>
        </div>

        <div className="drawer-body">
          <div className="job-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Customer ID</span>
              <span className="meta-value font-mono text-xs">{customer.id.substring(0, 12)}...</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Lifecycle Status</span>
              <span className={`badge badge-${customer.status}`}>{customer.status.toUpperCase()}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Monthly MRR</span>
              <span className="meta-value text-success font-bold">€{(customer.mrr_cents / 100).toFixed(2)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">First Seen</span>
              <span className="meta-value text-xs">{new Date(customer.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading customer timeline...</div>
          ) : (
            <>
              <div className="section-title">Assigned A/B Experiments ({timeline?.allocations.length || 0})</div>
              {timeline && timeline.allocations.length > 0 ? (
                <div className="allocations-list">
                  {timeline.allocations.map((a: any) => (
                    <div key={a.id} className="allocation-item">
                      <div className="alloc-info">
                        <strong>{a.experiment_name}</strong>
                        <code className="text-xs text-muted font-mono">({a.experiment_key})</code>
                      </div>
                      <div className="alloc-badges">
                        <span className="badge badge-primary font-mono">{a.variant_key.toUpperCase()}</span>
                        {a.converted ? (
                          <span className="badge badge-success">Converted</span>
                        ) : (
                          <span className="badge badge-warning">Not Converted</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-subtext">No experiment buckets assigned to this user.</div>
              )}

              <div className="section-title">Funnel Lifecycle Progression</div>
              {timeline && timeline.events.length > 0 ? (
                <div className="events-timeline">
                  {timeline.events.map((ev: any) => (
                    <div key={ev.id} className="timeline-item">
                      <span className="timeline-marker">●</span>
                      <div className="timeline-content">
                        <div className="timeline-stage">{ev.stage.toUpperCase()}</div>
                        <div className="timeline-date text-xs text-muted">
                          {new Date(ev.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-subtext">No funnel events recorded.</div>
              )}

              <div className="section-title">Reconciled Payment Transactions ({timeline?.ledger.length || 0})</div>
              {timeline && timeline.ledger.length > 0 ? (
                <div className="attempts-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Event</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.ledger.map((l: any) => (
                        <tr key={l.id}>
                          <td className="text-xs">{new Date(l.created_at).toLocaleDateString()}</td>
                          <td className="font-mono text-xs">{l.event_type}</td>
                          <td className="font-bold">€{(l.amount_cents / 100).toFixed(2)}</td>
                          <td>
                            <span className={`badge badge-${l.status}`}>{l.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-subtext">No billing transactions recorded for this customer.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

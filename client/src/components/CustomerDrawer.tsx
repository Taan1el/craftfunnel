import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Customer } from '../../../shared/types';
import { api } from '../services/index.js';
import { pluralize } from '../utils/pluralize.js';

interface TimelineEvent {
  id: string;
  stage: string;
  created_at: string;
}

interface Allocation {
  id: string;
  experiment_name: string;
  experiment_key: string;
  variant_key: string;
  converted: boolean;
}

interface LedgerRow {
  id: string;
  created_at: string;
  event_type: string;
  amount_cents: number;
  status: string;
}

interface CustomerTimeline {
  events: TimelineEvent[];
  allocations: Allocation[];
  ledger: LedgerRow[];
}

interface CustomerDrawerProps {
  customer: Customer | null;
  onClose: () => void;
}

export const CustomerDrawer: React.FC<CustomerDrawerProps> = ({ customer, onClose }) => {
  const [timeline, setTimeline] = useState<CustomerTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!customer) {
      setTimeline(null);
      return;
    }

    setLoading(true);
    api
      .getCustomerTimeline(customer.id)
      .then((data) => setTimeline(data as CustomerTimeline))
      .catch((err) => console.error('Failed to load customer timeline:', err))
      .finally(() => setLoading(false));
  }, [customer]);

  useEffect(() => {
    if (!customer) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [customer, onClose]);

  if (!customer) return null;

  return (
    <div className="drawer-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span className="drawer-pretitle">Customer</span>
            <h2 id="drawer-title" className="drawer-title">
              {customer.name}
            </h2>
            <span className="drawer-email mono">{customer.email}</span>
          </div>
          <button ref={closeButtonRef} className="drawer-close" onClick={onClose} aria-label="Close customer profile">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-meta-grid">
            <div className="drawer-meta-item">
              <span className="drawer-meta-label">Status</span>
              <span className="badge">{customer.status}</span>
            </div>
            <div className="drawer-meta-item">
              <span className="drawer-meta-label">MRR</span>
              <span className="drawer-meta-value">&euro;{(customer.mrr_cents / 100).toFixed(2)}</span>
            </div>
            <div className="drawer-meta-item">
              <span className="drawer-meta-label">First seen</span>
              <span className="drawer-meta-value">{new Date(customer.created_at).toLocaleDateString()}</span>
            </div>
            <div className="drawer-meta-item">
              <span className="drawer-meta-label">Customer id</span>
              <span className="drawer-meta-value">{customer.id.substring(0, 12)}</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading customer timeline.</div>
          ) : (
            <>
              <section>
                <h3 className="drawer-section-title">
                  Experiment allocations ({timeline?.allocations.length ?? 0})
                </h3>
                {timeline && timeline.allocations.length > 0 ? (
                  <div className="allocation-list">
                    {timeline.allocations.map((a) => (
                      <div key={a.id} className="allocation-row">
                        <span className="allocation-name">
                          {a.experiment_name}
                          <span className="allocation-key mono">{a.experiment_key}</span>
                        </span>
                        <span className="allocation-tags">
                          <span className="badge mono">{a.variant_key}</span>
                          <span className="significance-status" style={{ color: a.converted ? 'var(--ok)' : 'var(--ink-3)' }}>
                            <span className={`status-dot ${a.converted ? 'ok' : 'warn'}`} aria-hidden="true" />
                            {a.converted ? 'Converted' : 'Not converted'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-note">No experiment allocations for this customer.</p>
                )}
              </section>

              <section>
                <h3 className="drawer-section-title">Funnel events ({timeline?.events.length ?? 0})</h3>
                {timeline && timeline.events.length > 0 ? (
                  <ul className="event-timeline">
                    {timeline.events.map((ev) => (
                      <li key={ev.id} className="event-timeline-item">
                        <span className="event-stage">{ev.stage}</span>
                        <br />
                        <span className="event-time">{new Date(ev.created_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-note">No funnel events recorded.</p>
                )}
              </section>

              <section>
                <h3 className="drawer-section-title">
                  {(timeline?.ledger.length ?? 0)} {pluralize(timeline?.ledger.length ?? 0, 'ledger entry', 'ledger entries')}
                </h3>
                {timeline && timeline.ledger.length > 0 ? (
                  <div className="table-wrapper">
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
                        {timeline.ledger.map((l) => (
                          <tr key={l.id}>
                            <td style={{ fontSize: 13 }}>{new Date(l.created_at).toLocaleDateString()}</td>
                            <td className="mono" style={{ fontSize: 13 }}>
                              {l.event_type}
                            </td>
                            <td className="amount-cell">&euro;{(l.amount_cents / 100).toFixed(2)}</td>
                            <td>
                              <span className="badge">{l.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="empty-note">No payment transactions for this customer.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

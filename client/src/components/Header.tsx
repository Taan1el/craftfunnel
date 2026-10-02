import React from 'react';
import { RefreshCw } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  loading: boolean;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, loading, autoRefresh, onToggleAutoRefresh }) => {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-brand">
          <h1 className="brand-name">CraftFunnel</h1>
          <p className="brand-subtitle">
            Acquisition funnel, A/B experiments and Stripe payment reconciliation for a small SaaS.
          </p>
        </div>

        <div className="header-actions">
          <label className="live-toggle">
            <input type="checkbox" checked={autoRefresh} onChange={onToggleAutoRefresh} />
            <span>Refresh every 3s</span>
          </label>

          <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>
    </header>
  );
};

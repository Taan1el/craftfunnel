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
        <div>
          <h1 className="brand-name">CraftFunnel</h1>
          <p className="brand-subtitle">
            Acquisition funnel tracking, deterministic A/B experiment allocation, and Stripe webhook reconciliation.
          </p>
          <div className="header-meta">
            <span className="badge">v1.0</span>
          </div>
        </div>

        <div className="header-actions">
          <label className="live-toggle">
            <input type="checkbox" checked={autoRefresh} onChange={onToggleAutoRefresh} />
            Refresh every 3s
          </label>

          <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>
    </header>
  );
};

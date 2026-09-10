import React from 'react';
import type { GrowthMetrics } from '../../../shared/types';

interface MetricsOverviewProps {
  metrics: GrowthMetrics | null;
  loading: boolean;
  onRefresh: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  metrics,
  loading,
  onRefresh,
  autoRefresh,
  onToggleAutoRefresh,
}) => {
  return (
    <header className="metrics-banner">
      <div className="banner-top">
        <div className="brand-group">
          <div className="brand-icon">📈</div>
          <div>
            <h1 className="brand-title">CraftFunnel</h1>
            <p className="brand-subtitle">SaaS Growth Engine, A/B Testing Allocator & Stripe Reconciliation</p>
          </div>
        </div>

        <div className="banner-controls">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={onToggleAutoRefresh}
              aria-label="Toggle Live Polling"
            />
            <span className="live-indicator">
              <span className={`pulse-dot ${autoRefresh ? 'active' : ''}`} />
              Live Sync (3s)
            </span>
          </label>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh telemetry data"
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div className="stat-cards-grid">
        <div className="stat-card">
          <span className="stat-label">Monthly Recurring Revenue</span>
          <div className="stat-value text-success">
            {metrics ? `€${metrics.mrr_eur.toLocaleString()}` : '--'}
          </div>
          <span className="stat-hint">Active subscriptions MRR</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Active Subscribers</span>
          <div className="stat-value text-primary">
            {metrics ? metrics.active_subscribers : '--'}
          </div>
          <span className="stat-hint">Paying accounts</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total Leads & Customers</span>
          <div className="stat-value text-info">
            {metrics ? metrics.total_customers : '--'}
          </div>
          <span className="stat-hint">In customer lifecycle</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Overall Funnel Conversion</span>
          <div className="stat-value text-warning">
            {metrics ? `${metrics.funnel_conversion_rate}%` : '--'}
          </div>
          <span className="stat-hint">Visitor to Paid ratio</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">ARPU</span>
          <div className="stat-value">
            {metrics ? `€${metrics.arpu_eur}` : '--'}
          </div>
          <span className="stat-hint">Avg revenue per active user</span>
        </div>
      </div>
    </header>
  );
};

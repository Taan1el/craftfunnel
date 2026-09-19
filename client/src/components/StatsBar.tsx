import React from 'react';
import type { GrowthMetrics } from '../../../shared/types';
import { pluralize } from '../utils/pluralize.js';

interface StatsBarProps {
  metrics: GrowthMetrics | null;
}

export const StatsBar: React.FC<StatsBarProps> = ({ metrics }) => {
  if (!metrics) {
    return <div className="stats-strip-loading">Loading metrics.</div>;
  }

  return (
    <div className="stats-strip">
      <div className="stat-cell">
        <span className="stat-label">MRR</span>
        <span className="stat-value">
          &euro;{metrics.mrr_eur.toLocaleString()}
        </span>
      </div>

      <div className="stat-cell">
        <span className="stat-label">Active subscribers</span>
        <span className="stat-value">{metrics.active_subscribers}</span>
        <span className="stat-note">
          of {metrics.total_customers} {pluralize(metrics.total_customers, 'customer')}
        </span>
      </div>

      <div className="stat-cell">
        <span className="stat-label">Funnel conversion</span>
        <span className="stat-value">{metrics.funnel_conversion_rate}%</span>
        <span className="stat-note">visitor to paid</span>
      </div>

      <div className="stat-cell">
        <span className="stat-label">ARPU</span>
        <span className="stat-value">&euro;{metrics.arpu_eur}</span>
        <span className="stat-note">per active subscriber</span>
      </div>
    </div>
  );
};

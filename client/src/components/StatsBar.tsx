import React from 'react';
import type { GrowthMetrics } from '../../../shared/types';
import { pluralize } from '../utils/pluralize.js';

interface StatsBarProps {
  metrics: GrowthMetrics | null;
}

export const StatsBar: React.FC<StatsBarProps> = ({ metrics }) => {
  if (!metrics) {
    return <div className="numerals-loading">Loading metrics.</div>;
  }

  return (
    <dl className="numerals">
      <div className="numeral">
        <dt>MRR</dt>
        <dd className="numeral-value">&euro;{metrics.mrr_eur.toLocaleString()}</dd>
      </div>

      <div className="numeral">
        <dt>Active subscribers</dt>
        <dd className="numeral-value">{metrics.active_subscribers}</dd>
        <dd className="numeral-note">
          of {metrics.total_customers} {pluralize(metrics.total_customers, 'customer')}
        </dd>
      </div>

      <div className="numeral">
        <dt>Funnel conversion</dt>
        <dd className="numeral-value">{metrics.funnel_conversion_rate}%</dd>
        <dd className="numeral-note">visitor to paid</dd>
      </div>

      <div className="numeral">
        <dt>ARPU</dt>
        <dd className="numeral-value">&euro;{metrics.arpu_eur}</dd>
        <dd className="numeral-note">per active subscriber</dd>
      </div>
    </dl>
  );
};

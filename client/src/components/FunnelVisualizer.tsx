import React from 'react';
import type { FunnelStepMetric } from '../../../shared/types';

interface FunnelVisualizerProps {
  steps: FunnelStepMetric[];
}

export const FunnelVisualizer: React.FC<FunnelVisualizerProps> = ({ steps }) => {
  const maxCount = steps[0]?.total_count || 1;

  // Find step with largest drop-off
  const highestDropoff = [...steps]
    .slice(1)
    .sort((a, b) => b.dropoff_rate - a.dropoff_rate)[0];

  return (
    <div className="funnel-section">
      <div className="section-header">
        <div>
          <h2 className="section-heading">SaaS Customer Acquisition Funnel</h2>
          <p className="section-subheading">
            Cohort progression tracking from initial anonymous landing visit to settled Stripe paid subscription.
          </p>
        </div>
      </div>

      <div className="funnel-steps-container">
        {steps.map((step, idx) => {
          const widthPercent = Math.max(12, Math.round((step.total_count / maxCount) * 100));

          return (
            <div key={step.stage} className="funnel-step-row">
              <div className="step-info">
                <span className="step-label">{step.label}</span>
                <span className="step-count font-mono">{step.total_count} users</span>
              </div>

              <div className="step-bar-wrapper">
                <div
                  className={`step-bar step-bar-${idx}`}
                  style={{ width: `${widthPercent}%` }}
                >
                  <span className="step-bar-text">
                    {step.conversion_rate_from_first}% total
                  </span>
                </div>
              </div>

              <div className="step-metrics">
                {idx > 0 ? (
                  <span className="dropoff-badge text-danger font-mono">
                    ↓ {step.dropoff_rate}% drop-off
                  </span>
                ) : (
                  <span className="dropoff-badge text-success font-mono">Top of Funnel</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {highestDropoff && (
        <div className="funnel-insight-card">
          <span className="insight-icon">💡</span>
          <div>
            <strong>Growth Optimization Opportunity:</strong> The largest drop-off occurs at{' '}
            <em>{highestDropoff.label}</em> with a{' '}
            <strong className="text-danger">{highestDropoff.dropoff_rate}%</strong> drop-off rate. A/B testing
            this specific friction point represents the highest leverage growth experiment.
          </div>
        </div>
      )}
    </div>
  );
};

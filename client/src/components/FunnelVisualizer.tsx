import React from 'react';
import { Lightbulb } from 'lucide-react';
import type { FunnelStepMetric } from '../../../shared/types';
import { pluralize } from '../utils/pluralize.js';

interface FunnelVisualizerProps {
  steps: FunnelStepMetric[];
}

export const FunnelVisualizer: React.FC<FunnelVisualizerProps> = ({ steps }) => {
  const maxCount = steps[0]?.total_count || 1;

  const highestDropoff = [...steps].slice(1).sort((a, b) => b.dropoff_rate - a.dropoff_rate)[0];

  return (
    <div>
      <div className="section-header">
        <h2 className="section-heading">Acquisition funnel</h2>
        <p className="section-description">
          Customer progression from first landing visit to a settled paid subscription. Each bar is the share of the
          top-of-funnel count that reached that stage.
        </p>
      </div>

      <div className="funnel-list" role="table" aria-label="Funnel stage counts and drop-off rates">
        {steps.map((step, idx) => {
          const widthPercent = Math.max(2, Math.round((step.total_count / maxCount) * 100));

          return (
            <div key={step.stage} className="funnel-row" role="row">
              <span className="funnel-stage-label" role="cell">
                {step.label}
              </span>

              <div className="funnel-bar-track" aria-hidden="true">
                <div className="funnel-bar-fill" style={{ width: `${widthPercent}%` }} />
              </div>

              <span className="funnel-count" role="cell">
                {step.total_count} {pluralize(step.total_count, 'user')} ({step.conversion_rate_from_first}%)
              </span>

              <span className={`funnel-dropoff ${idx > 0 && step.dropoff_rate > 0 ? 'has-dropoff' : ''}`} role="cell">
                {idx === 0 ? 'start' : step.dropoff_rate > 0 ? `-${step.dropoff_rate}%` : 'no drop-off'}
              </span>
            </div>
          );
        })}
      </div>

      {highestDropoff && (
        <div className="funnel-insight">
          <Lightbulb size={16} aria-hidden="true" />
          <span>
            The largest drop-off is at <strong>{highestDropoff.label}</strong>, losing{' '}
            <strong>{highestDropoff.dropoff_rate}%</strong> of the customers who reached the stage before it.
          </span>
        </div>
      )}
    </div>
  );
};

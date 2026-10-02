import React from 'react';
import { TrendingDown } from 'lucide-react';
import type { FunnelStepMetric } from '../../../shared/types';
import { pluralize } from '../utils/pluralize.js';

interface FunnelVisualizerProps {
  steps: FunnelStepMetric[];
}

export const FunnelVisualizer: React.FC<FunnelVisualizerProps> = ({ steps }) => {
  const maxCount = steps[0]?.total_count || 1;

  const highestDropoff = [...steps].slice(1).sort((a, b) => b.dropoff_rate - a.dropoff_rate)[0];

  return (
    <section className="funnel" aria-labelledby="funnel-title">
      <div className="funnel-head">
        <h2 id="funnel-title" className="funnel-title">
          Acquisition funnel
        </h2>
        <p className="funnel-description">
          From first landing visit to a settled paid subscription. Each bar is the share of the top-of-funnel count that
          reached that stage.
        </p>
      </div>

      <ol className="stages" aria-label="Funnel stage counts and drop-off rates">
        {steps.map((step, idx) => {
          const widthPercent = Math.max(2, Math.round((step.total_count / maxCount) * 100));
          const isWorst = highestDropoff?.stage === step.stage && step.dropoff_rate > 0;

          return (
            <li key={step.stage} className="stage">
              {idx > 0 && (
                <div className="stage-gap">
                  <span className={`dropoff-chip ${isWorst ? 'is-worst' : ''}`}>
                    {step.dropoff_rate > 0 ? `-${step.dropoff_rate}% drop-off` : 'no drop-off'}
                  </span>
                </div>
              )}
              <div className="stage-head">
                <span className="stage-label">{step.label}</span>
                <span className="stage-count">
                  {step.total_count} {pluralize(step.total_count, 'user')} ({step.conversion_rate_from_first}%)
                </span>
              </div>
              <div className="stage-track" aria-hidden="true">
                <div className="stage-bar" style={{ width: `${widthPercent}%` }} />
              </div>
            </li>
          );
        })}
      </ol>

      {highestDropoff && (
        <p className="funnel-insight">
          <TrendingDown size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>
            The largest drop-off is at <strong>{highestDropoff.label}</strong>, losing{' '}
            <strong>{highestDropoff.dropoff_rate}%</strong> of the customers who reached the stage before it.
          </span>
        </p>
      )}
    </section>
  );
};

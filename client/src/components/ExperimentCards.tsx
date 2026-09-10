import React, { useState } from 'react';
import type { Experiment } from '../../../shared/types';
import { api } from '../services/api';

interface ExperimentCardsProps {
  experiments: Experiment[];
  onRefresh: () => void;
}

export const ExperimentCards: React.FC<ExperimentCardsProps> = ({ experiments, onRefresh }) => {
  const [testUserId, setTestUserId] = useState('usr_candidate_99');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateId = () => {
    setTestUserId(`usr_${Math.random().toString(36).substring(2, 9)}`);
    setActionFeedback(null);
  };

  const handleEvaluate = async (expKey: string) => {
    setLoading(true);
    setActionFeedback(null);
    try {
      const res = await api.evaluateExperiment(expKey, testUserId);
      setActionFeedback(
        `Deterministic Hash: User '${testUserId}' assigned to variant '${res.variant.toUpperCase()}' (${res.isNew ? 'New Allocation' : 'Cached Persisted Allocation'})`
      );
      onRefresh();
    } catch (err: any) {
      setActionFeedback(`Evaluation error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async (expKey: string) => {
    setLoading(true);
    try {
      const res = await api.convertExperiment(expKey, testUserId);
      if (res.converted) {
        setActionFeedback(`Conversion recorded for user '${testUserId}'!`);
      } else {
        setActionFeedback(`User '${testUserId}' already converted or not yet allocated.`);
      }
      onRefresh();
    } catch (err: any) {
      setActionFeedback(`Conversion error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="experiments-section">
      <div className="section-header">
        <div>
          <h2 className="section-heading">A/B Testing & Statistical Experimentation</h2>
          <p className="section-subheading">
            Deterministic variant hashing (<code>SHA256(userId + experimentKey) % 100</code>) with real-time 2-proportion Z-score significance testing.
          </p>
        </div>
      </div>

      <div className="experiments-grid">
        {experiments.map((exp) => {
          const control = exp.variants.find((v) => v.key === 'control');
          const treatment = exp.variants.find((v) => v.key !== 'control');
          const lift =
            control && treatment && control.conversion_rate > 0
              ? Math.round(((treatment.conversion_rate - control.conversion_rate) / control.conversion_rate) * 1000) / 10
              : 0;

          return (
            <div key={exp.id} className="experiment-card">
              <div className="exp-card-header">
                <div>
                  <h3 className="exp-title">{exp.name}</h3>
                  <code className="font-mono text-xs text-muted">{exp.key}</code>
                </div>
                <span className="badge badge-success">{exp.status.toUpperCase()}</span>
              </div>

              <p className="exp-description">{exp.description}</p>
              <div className="exp-target">
                Target Metric: <strong>{exp.target_metric}</strong>
              </div>

              <div className="variants-grid">
                {exp.variants.map((v) => (
                  <div key={v.id} className="variant-box">
                    <div className="variant-header">
                      <span className="variant-name">{v.name}</span>
                      <span className="variant-weight font-mono">{v.weight}% Traffic</span>
                    </div>

                    <div className="variant-stats">
                      <div className="v-stat">
                        <span className="v-num">{v.visitors}</span>
                        <span className="v-label">Visitors</span>
                      </div>
                      <div className="v-stat">
                        <span className="v-num">{v.conversions}</span>
                        <span className="v-label">Conversions</span>
                      </div>
                      <div className="v-stat">
                        <span className="v-num text-primary font-bold">{v.conversion_rate}%</span>
                        <span className="v-label">Conv. Rate</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Statistical Significance Footer */}
              <div className="significance-banner">
                <div className="sig-metrics">
                  <span>Relative Lift: <strong className={lift >= 0 ? 'text-success' : 'text-danger'}>{lift >= 0 ? `+${lift}%` : `${lift}%`}</strong></span>
                  <span>Z-Score: <strong className="font-mono">{exp.z_score ?? '--'}</strong></span>
                  <span>Confidence: <strong>{exp.confidence_percentage ? `${exp.confidence_percentage}%` : '--'}</strong></span>
                </div>
                <div className="sig-badge-wrap">
                  {exp.is_significant ? (
                    <span className="badge badge-success">🏆 Statistically Significant (&gt;95%)</span>
                  ) : (
                    <span className="badge badge-warning">⏳ Gathering Traffic Sample</span>
                  )}
                </div>
              </div>

              {/* Live Testing Simulator */}
              <div className="exp-simulator">
                <div className="sim-title">Live Variant Bucket Tester</div>
                <div className="sim-inputs">
                  <input
                    type="text"
                    value={testUserId}
                    onChange={(e) => setTestUserId(e.target.value)}
                    className="form-input input-xs font-mono"
                    placeholder="User ID"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={handleGenerateId}
                  >
                    🎲 New User
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={() => handleEvaluate(exp.key)}
                    disabled={loading}
                  >
                    Evaluate Bucket
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-xs"
                    onClick={() => handleConvert(exp.key)}
                    disabled={loading}
                  >
                    Trigger Conversion
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {actionFeedback && (
        <div className="alert-box alert-info">
          {actionFeedback}
        </div>
      )}
    </div>
  );
};

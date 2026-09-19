import React, { useState } from 'react';
import { Dices } from 'lucide-react';
import type { Experiment } from '../../../shared/types';
import { api } from '../services/index.js';

interface ExperimentCardsProps {
  experiments: Experiment[];
  onRefresh: () => void;
}

export const ExperimentCards: React.FC<ExperimentCardsProps> = ({ experiments, onRefresh }) => {
  const [selectedKey, setSelectedKey] = useState(experiments[0]?.key ?? '');
  const [testUserId, setTestUserId] = useState('usr_sample_99');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'info' | 'error' | 'success' } | null>(null);
  const [loading, setLoading] = useState(false);

  const activeKey = selectedKey || experiments[0]?.key || '';

  const handleGenerateId = () => {
    setTestUserId(`usr_${Math.random().toString(36).substring(2, 9)}`);
    setFeedback(null);
  };

  const handleEvaluate = async () => {
    if (!activeKey) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.evaluateExperiment(activeKey, testUserId);
      setFeedback({
        tone: 'success',
        message: `${testUserId} assigned to variant "${res.variant}" (${res.isNew ? 'new allocation' : 'existing allocation'}).`,
      });
      onRefresh();
    } catch (err) {
      setFeedback({ tone: 'error', message: `Evaluation failed: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!activeKey) return;
    setLoading(true);
    try {
      const res = await api.convertExperiment(activeKey, testUserId);
      setFeedback({
        tone: res.converted ? 'success' : 'info',
        message: res.converted
          ? `Conversion recorded for ${testUserId}.`
          : `${testUserId} has no allocation yet, or already converted.`,
      });
      onRefresh();
    } catch (err) {
      setFeedback({ tone: 'error', message: `Conversion failed: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-heading">A/B experiments</h2>
        <p className="section-description">
          Variant allocation is deterministic: <code>SHA256(userId + experimentKey) mod 100</code>. Significance is a
          two-proportion Z-test, reported once both variants have at least 10 visitors.
        </p>
      </div>

      <div className="experiments-split">
        <div className="experiments-list">
          {experiments.map((exp) => {
            const control = exp.variants.find((v) => v.key === 'control');
            const treatment = exp.variants.find((v) => v.key !== 'control');
            const lift =
              control && treatment && control.conversion_rate > 0
                ? Math.round(((treatment.conversion_rate - control.conversion_rate) / control.conversion_rate) * 1000) / 10
                : 0;

            return (
              <div key={exp.id} className="experiment-row">
                <div className="experiment-row-header">
                  <span>
                    <span className="experiment-name">{exp.name}</span>
                    <span className="experiment-key mono">{exp.key}</span>
                  </span>
                  <span className="badge">{exp.status}</span>
                </div>

                <p className="experiment-description">{exp.description}</p>

                <div className="variant-cols-header">
                  <span>Variant</span>
                  <span>Visitors</span>
                  <span>Conversions</span>
                  <span>Rate</span>
                </div>
                <div className="variant-rows">
                  {exp.variants.map((v) => (
                    <div key={v.id} className="variant-row">
                      <span className="variant-name">
                        {v.name} <span className="stat-dim">({v.weight}%)</span>
                      </span>
                      <span className="variant-num">{v.visitors}</span>
                      <span className="variant-num">{v.conversions}</span>
                      <span className="variant-num rate">{v.conversion_rate}%</span>
                    </div>
                  ))}
                </div>

                <div className="experiment-result-row">
                  <div className="experiment-result-metrics">
                    <span>
                      Lift <strong>{lift >= 0 ? `+${lift}` : lift}%</strong>
                    </span>
                    <span>
                      Z <strong>{exp.z_score ?? '-'}</strong>
                    </span>
                    <span>
                      Confidence <strong>{exp.confidence_percentage != null ? `${exp.confidence_percentage}%` : '-'}</strong>
                    </span>
                  </div>
                  {exp.is_significant ? (
                    <span className="significance-status is-significant">
                      <span className="status-dot ok" aria-hidden="true" />
                      Significant at 95%
                    </span>
                  ) : (
                    <span className="significance-status is-pending">
                      <span className="status-dot warn" aria-hidden="true" />
                      Gathering traffic
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="form-column">
          <h3 className="form-column-title">Test a user</h3>
          <p className="form-column-description">
            Check which variant a user id lands in, or record a conversion for it.
          </p>

          <div className="field">
            <label className="field-label" htmlFor="test-experiment">
              Experiment
            </label>
            <select
              id="test-experiment"
              className="form-input"
              value={activeKey}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              {experiments.map((exp) => (
                <option key={exp.key} value={exp.key}>
                  {exp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="test-user-id">
              User id
            </label>
            <div className="field-row">
              <input
                id="test-user-id"
                type="text"
                className="form-input mono"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
              />
              <button type="button" className="btn btn-secondary" onClick={handleGenerateId} title="Generate a new user id">
                <Dices size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-primary btn-block" onClick={handleEvaluate} disabled={loading || !activeKey}>
              Evaluate bucket
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={handleConvert} disabled={loading || !activeKey}>
              Record conversion
            </button>
          </div>

          {feedback && (
            <div
              className={`result-note ${feedback.tone === 'error' ? 'is-error' : feedback.tone === 'success' ? 'is-success' : ''}`}
              role="status"
            >
              {feedback.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

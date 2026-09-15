import { describe, it, expect } from 'vitest';
import { computeFunnelMetrics, isValidFunnelStage, FUNNEL_STAGES } from '../../shared/funnel-logic.js';

describe('computeFunnelMetrics', () => {
  it('reports all zeros for an empty funnel instead of dividing by a faked denominator', () => {
    const result = computeFunnelMetrics({});

    expect(result).toHaveLength(FUNNEL_STAGES.length);
    for (const step of result) {
      expect(step.total_count).toBe(0);
      expect(step.conversion_rate_from_first).toBe(0);
      expect(step.dropoff_rate).toBe(0);
    }
  });

  it('computes conversion-from-first and drop-off rates relative to the previous stage', () => {
    const result = computeFunnelMetrics({
      visited: 100,
      onboarded: 80,
      activated: 40,
      trial_started: 40,
      converted_paid: 10,
    });

    expect(result.map((s) => s.total_count)).toEqual([100, 80, 40, 40, 10]);
    expect(result.map((s) => s.conversion_rate_from_first)).toEqual([100, 80, 40, 40, 10]);
    // onboarded -> activated: (80-40)/80 = 50%
    expect(result[2].dropoff_rate).toBe(50);
    // activated -> trial_started: no drop-off
    expect(result[3].dropoff_rate).toBe(0);
    // trial_started -> converted_paid: (40-10)/40 = 75%
    expect(result[4].dropoff_rate).toBe(75);
    // First stage is always "top of funnel": no drop-off relative to itself.
    expect(result[0].dropoff_rate).toBe(0);
  });

  it('never reports a negative drop-off when a later stage count is inconsistent with the one before it', () => {
    // Stages are tracked independently by whatever event the client sends,
    // so nothing stops a stage further down the funnel from having more
    // unique customers than the one before it (e.g. a customer whose
    // 'onboarded' event never fired). The rate should clamp at 0, not go
    // negative.
    const result = computeFunnelMetrics({ visited: 10, onboarded: 20 });
    expect(result[1].dropoff_rate).toBe(0);
  });

  it('treats a stage with zero visited-but-nonzero later count as 0% rather than a fabricated percentage over 100', () => {
    // firstStageCount is 0 here (no 'visited' events), while a later stage
    // has events. Dividing by a denominator faked to 1 would report this as
    // "500%"; guarding the division explicitly reports 0% instead.
    const result = computeFunnelMetrics({ activated: 5 });
    expect(result[0].total_count).toBe(0);
    expect(result[2].conversion_rate_from_first).toBe(0);
  });

  it('rounds rates to one decimal place', () => {
    const result = computeFunnelMetrics({ visited: 3, onboarded: 1 });
    // 1/3 = 33.333...% -> 33.3
    expect(result[1].conversion_rate_from_first).toBe(33.3);
    // (3-1)/3 = 66.666...% -> 66.7
    expect(result[1].dropoff_rate).toBe(66.7);
  });
});

describe('isValidFunnelStage', () => {
  it('accepts every known stage', () => {
    for (const { stage } of FUNNEL_STAGES) {
      expect(isValidFunnelStage(stage)).toBe(true);
    }
  });

  it('rejects unknown strings and non-strings', () => {
    expect(isValidFunnelStage('subscribed')).toBe(false);
    expect(isValidFunnelStage('')).toBe(false);
    expect(isValidFunnelStage(null)).toBe(false);
    expect(isValidFunnelStage(undefined)).toBe(false);
    expect(isValidFunnelStage(42)).toBe(false);
  });
});

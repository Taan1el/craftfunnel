// Pure funnel aggregation math shared by the server (which feeds it counts
// grouped from SQL) and the in-browser demo (which feeds it counts grouped
// from the seeded in-memory event list), so both compute the same numbers
// the same way.
import { FunnelStage, FunnelStepMetric } from './types.js';
import { ratioToPercentage } from './format.js';

export const FUNNEL_STAGES: { stage: FunnelStage; label: string }[] = [
  { stage: 'visited', label: '1. Landing Page Visit' },
  { stage: 'onboarded', label: '2. Profile Setup & Onboarding' },
  { stage: 'activated', label: '3. Core Feature Activation' },
  { stage: 'trial_started', label: '4. Free Trial Initiated' },
  { stage: 'converted_paid', label: '5. Paid Subscription' },
];

const VALID_STAGES = new Set<string>(FUNNEL_STAGES.map((s) => s.stage));

export function isValidFunnelStage(value: unknown): value is FunnelStage {
  return typeof value === 'string' && VALID_STAGES.has(value);
}

/**
 * Turns per-stage unique-visitor counts into the funnel step metrics the UI
 * renders: count, conversion rate back to the first stage, and drop-off from
 * the previous stage. Every division is guarded explicitly (no dividing by a
 * denominator faked to 1) so an empty funnel reports all zeros instead of
 * misleading percentages.
 */
export function computeFunnelMetrics(countsByStage: Record<string, number>): FunnelStepMetric[] {
  const firstStageCount = countsByStage[FUNNEL_STAGES[0].stage] || 0;
  let prevCount = firstStageCount;

  return FUNNEL_STAGES.map(({ stage, label }) => {
    const count = countsByStage[stage] || 0;

    const conversionRateFromFirst = firstStageCount > 0 ? ratioToPercentage(count / firstStageCount) : 0;

    const droppedSincePrev = Math.max(0, prevCount - count);
    const dropoffRate = prevCount > 0 ? ratioToPercentage(droppedSincePrev / prevCount) : 0;

    prevCount = count;

    return {
      stage,
      label,
      total_count: count,
      conversion_rate_from_first: conversionRateFromFirst,
      dropoff_rate: dropoffRate,
    };
  });
}

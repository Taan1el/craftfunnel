import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { FunnelStage, FunnelStepMetric } from '../../../shared/types.js';

const STAGES: { stage: FunnelStage; label: string }[] = [
  { stage: 'visited', label: '1. Landing Page Visit' },
  { stage: 'onboarded', label: '2. Profile Setup & Onboarding' },
  { stage: 'activated', label: '3. Core Feature Activation' },
  { stage: 'trial_started', label: '4. Free Trial Initiated' },
  { stage: 'converted_paid', label: '5. Paid Subscription' },
];

export class FunnelRepository {
  constructor(private db: DatabaseSync) {}

  trackEvent(customerId: string, stage: FunnelStage, metadata?: Record<string, unknown>): void {
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO funnel_events (id, customer_id, stage, metadata, created_at)
      VALUES (?, ?, ?, ?, ?);
    `);
    stmt.run(id, customerId, stage, metadata ? JSON.stringify(metadata) : null, nowIso);
  }

  getFunnelMetrics(): FunnelStepMetric[] {
    const countsByStage: Record<string, number> = {};

    const stmt = this.db.prepare(`
      SELECT stage, COUNT(DISTINCT customer_id) as unique_users
      FROM funnel_events
      GROUP BY stage;
    `);
    const rows = stmt.all() as { stage: string; unique_users: number }[];

    for (const r of rows) {
      countsByStage[r.stage] = Number(r.unique_users);
    }

    const firstStageCount = countsByStage['visited'] || 1;
    let prevCount = firstStageCount;

    return STAGES.map(({ stage, label }) => {
      const count = countsByStage[stage] || 0;
      const conversionRateFromFirst = Math.round((count / firstStageCount) * 1000) / 10;
      const dropoffRate = prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 1000) / 10 : 0;
      prevCount = count;

      return {
        stage,
        label,
        total_count: count,
        conversion_rate_from_first: conversionRateFromFirst,
        dropoff_rate: Math.max(0, dropoffRate),
      };
    });
  }
}

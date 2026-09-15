import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { FunnelStage, FunnelStepMetric } from '../../../shared/types.js';
import { computeFunnelMetrics } from '../../../shared/funnel-logic.js';

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
    const stmt = this.db.prepare(`
      SELECT stage, COUNT(DISTINCT customer_id) as unique_users
      FROM funnel_events
      GROUP BY stage;
    `);
    const rows = stmt.all() as { stage: string; unique_users: number }[];

    const countsByStage: Record<string, number> = {};
    for (const r of rows) {
      countsByStage[r.stage] = Number(r.unique_users);
    }

    return computeFunnelMetrics(countsByStage);
  }
}

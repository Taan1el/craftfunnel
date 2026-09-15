import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { Experiment, Variant } from '../../../shared/types.js';
import { ratioToPercentage } from '../../../shared/format.js';

export class ExperimentRepository {
  constructor(private db: DatabaseSync) {}

  listExperiments(): Experiment[] {
    const expStmt = this.db.prepare('SELECT * FROM experiments ORDER BY created_at DESC;');
    const expRows = expStmt.all() as any[];

    const variantStmt = this.db.prepare('SELECT * FROM variants WHERE experiment_id = ? ORDER BY key ASC;');

    return expRows.map((exp) => {
      const vRows = variantStmt.all(exp.id) as any[];
      const variants: Variant[] = vRows.map((v) => ({
        id: v.id,
        experiment_id: v.experiment_id,
        key: v.key,
        name: v.name,
        weight: Number(v.weight),
        visitors: Number(v.visitors),
        conversions: Number(v.conversions),
        conversion_rate: v.visitors > 0 ? ratioToPercentage(v.conversions / v.visitors) : 0,
      }));

      return {
        id: exp.id,
        key: exp.key,
        name: exp.name,
        description: exp.description,
        status: exp.status,
        target_metric: exp.target_metric,
        created_at: exp.created_at,
        variants,
      };
    });
  }

  getExperimentByKey(key: string): Experiment | null {
    const stmt = this.db.prepare('SELECT * FROM experiments WHERE key = ?;');
    const exp = stmt.get(key) as any;
    if (!exp) return null;

    const variantStmt = this.db.prepare('SELECT * FROM variants WHERE experiment_id = ? ORDER BY key ASC;');
    const vRows = variantStmt.all(exp.id) as any[];
    const variants: Variant[] = vRows.map((v) => ({
      id: v.id,
      experiment_id: v.experiment_id,
      key: v.key,
      name: v.name,
      weight: Number(v.weight),
      visitors: Number(v.visitors),
      conversions: Number(v.conversions),
      conversion_rate: v.visitors > 0 ? ratioToPercentage(v.conversions / v.visitors) : 0,
    }));

    return {
      id: exp.id,
      key: exp.key,
      name: exp.name,
      description: exp.description,
      status: exp.status,
      target_metric: exp.target_metric,
      created_at: exp.created_at,
      variants,
    };
  }

  getAllocation(experimentId: string, userId: string): { variant_key: string; converted: boolean } | null {
    const stmt = this.db.prepare(`
      SELECT variant_key, converted FROM experiment_allocations
      WHERE experiment_id = ? AND user_id = ?;
    `);
    const row = stmt.get(experimentId, userId) as any;
    if (!row) return null;
    return { variant_key: row.variant_key, converted: Boolean(row.converted) };
  }

  recordAllocation(experimentId: string, userId: string, variantKey: string): void {
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO experiment_allocations (id, experiment_id, user_id, variant_key, converted, allocated_at)
      VALUES (?, ?, ?, ?, 0, ?);
    `);
    stmt.run(id, experimentId, userId, variantKey, nowIso);

    // Increment variant visitors count
    this.db.prepare(`
      UPDATE variants
      SET visitors = visitors + 1
      WHERE experiment_id = ? AND key = ?;
    `).run(experimentId, variantKey);
  }

  recordConversion(experimentId: string, userId: string): boolean {
    const nowIso = new Date().toISOString();
    const updateAlloc = this.db.prepare(`
      UPDATE experiment_allocations
      SET converted = 1, converted_at = ?
      WHERE experiment_id = ? AND user_id = ? AND converted = 0;
    `);
    const res = updateAlloc.run(nowIso, experimentId, userId) as any;

    if (res.changes > 0) {
      const alloc = this.getAllocation(experimentId, userId);
      if (alloc) {
        this.db.prepare(`
          UPDATE variants
          SET conversions = conversions + 1
          WHERE experiment_id = ? AND key = ?;
        `).run(experimentId, alloc.variant_key);
        return true;
      }
    }
    return false;
  }
}

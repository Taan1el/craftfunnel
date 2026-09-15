import { DatabaseSync } from 'node:sqlite';
import { Customer, CustomerStatus } from '../../../shared/types.js';

export class CustomerRepository {
  constructor(private db: DatabaseSync) {}

  listCustomers(): Customer[] {
    const stmt = this.db.prepare('SELECT * FROM customers ORDER BY created_at DESC;');
    const rows = stmt.all() as any[];

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      status: r.status as CustomerStatus,
      mrr_cents: Number(r.mrr_cents),
      created_at: r.created_at,
    }));
  }

  getCustomerById(id: string): Customer | null {
    const stmt = this.db.prepare('SELECT * FROM customers WHERE id = ?;');
    const r = stmt.get(id) as any;
    if (!r) return null;

    return {
      id: r.id,
      email: r.email,
      name: r.name,
      status: r.status as CustomerStatus,
      mrr_cents: Number(r.mrr_cents),
      created_at: r.created_at,
    };
  }

  updateStatus(id: string, status: CustomerStatus, mrrCents?: number): void {
    const stmt = this.db.prepare(`
      UPDATE customers
      SET status = ?, mrr_cents = COALESCE(?, mrr_cents)
      WHERE id = ?;
    `);
    stmt.run(status, mrrCents !== undefined ? mrrCents : null, id);
  }

  getCustomerTimeline(customerId: string): { events: any[]; allocations: any[]; ledger: any[] } {
    const events = this.db.prepare(`
      SELECT * FROM funnel_events WHERE customer_id = ? ORDER BY created_at DESC;
    `).all(customerId);

    const allocations = this.db.prepare(`
      SELECT ea.*, e.name as experiment_name, e.key as experiment_key
      FROM experiment_allocations ea
      JOIN experiments e ON ea.experiment_id = e.id
      WHERE ea.user_id = ?;
    `).all(customerId);

    const ledger = this.db.prepare(`
      SELECT * FROM payment_ledger WHERE customer_id = ? ORDER BY created_at DESC;
    `).all(customerId);

    return { events, allocations, ledger };
  }
}

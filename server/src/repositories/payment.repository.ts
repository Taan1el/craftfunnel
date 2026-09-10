import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { GrowthMetrics, PaymentLedgerEntry } from '../../../shared/types.js';

export class PaymentRepository {
  constructor(private db: DatabaseSync) {}

  isWebhookProcessed(stripeEventId: string): boolean {
    const stmt = this.db.prepare('SELECT id FROM processed_webhooks WHERE id = ?;');
    const row = stmt.get(stripeEventId);
    return Boolean(row);
  }

  markWebhookProcessed(stripeEventId: string, eventType: string, status = 'processed'): void {
    const stmt = this.db.prepare(`
      INSERT INTO processed_webhooks (id, event_type, status, processed_at)
      VALUES (?, ?, ?, ?);
    `);
    stmt.run(stripeEventId, eventType, status, new Date().toISOString());
  }

  recordLedgerEntry(entry: {
    customer_id: string;
    stripe_event_id: string;
    event_type: string;
    amount_cents: number;
    currency?: string;
    status: 'settled' | 'failed' | 'refunded';
    invoice_id?: string | null;
  }): PaymentLedgerEntry {
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO payment_ledger (
        id, customer_id, stripe_event_id, event_type, amount_cents, currency, status, invoice_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    stmt.run(
      id,
      entry.customer_id,
      entry.stripe_event_id,
      entry.event_type,
      entry.amount_cents,
      entry.currency || 'EUR',
      entry.status,
      entry.invoice_id || null,
      nowIso
    );

    return {
      id,
      customer_id: entry.customer_id,
      stripe_event_id: entry.stripe_event_id,
      event_type: entry.event_type,
      amount_cents: entry.amount_cents,
      currency: entry.currency || 'EUR',
      status: entry.status,
      invoice_id: entry.invoice_id,
      created_at: nowIso,
    };
  }

  listLedger(limit = 50): PaymentLedgerEntry[] {
    const stmt = this.db.prepare(`
      SELECT pl.*, c.email as customer_email
      FROM payment_ledger pl
      JOIN customers c ON pl.customer_id = c.id
      ORDER BY pl.created_at DESC
      LIMIT ?;
    `);
    const rows = stmt.all(limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      customer_id: r.customer_id,
      customer_email: r.customer_email,
      stripe_event_id: r.stripe_event_id,
      event_type: r.event_type,
      amount_cents: Number(r.amount_cents),
      currency: r.currency,
      status: r.status,
      invoice_id: r.invoice_id,
      created_at: r.created_at,
    }));
  }

  getGrowthMetrics(): GrowthMetrics {
    const custStmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_customers,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_subscribers,
        SUM(CASE WHEN status = 'active' THEN mrr_cents ELSE 0 END) as total_mrr_cents
      FROM customers;
    `);
    const custRow = custStmt.get() as any;

    const totalCust = Number(custRow?.total_customers || 0);
    const activeSub = Number(custRow?.active_subscribers || 0);
    const totalMrrCents = Number(custRow?.total_mrr_cents || 0);

    const mrrEur = Math.round(totalMrrCents / 100);
    const arpuEur = activeSub > 0 ? Math.round((mrrEur / activeSub) * 10) / 10 : 0;

    // Overall conversion rate: paid vs visited
    const funnelStmt = this.db.prepare(`
      SELECT
        SUM(CASE WHEN stage = 'visited' THEN 1 ELSE 0 END) as visits,
        SUM(CASE WHEN stage = 'converted_paid' THEN 1 ELSE 0 END) as paids
      FROM funnel_events;
    `);
    const funnelRow = funnelStmt.get() as any;
    const visits = Number(funnelRow?.visits || 1);
    const paids = Number(funnelRow?.paids || 0);
    const conversionRate = Math.round((paids / (visits || 1)) * 1000) / 10;

    return {
      mrr_eur: mrrEur,
      total_customers: totalCust,
      active_subscribers: activeSub,
      funnel_conversion_rate: conversionRate,
      arpu_eur: arpuEur,
    };
  }
}

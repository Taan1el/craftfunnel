import { DatabaseSync } from 'node:sqlite';

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'lead',
      mrr_cents INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      target_metric TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      weight INTEGER NOT NULL DEFAULT 50,
      visitors INTEGER NOT NULL DEFAULT 0,
      conversions INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
      UNIQUE(experiment_id, key)
    );

    CREATE TABLE IF NOT EXISTS experiment_allocations (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      variant_key TEXT NOT NULL,
      converted INTEGER NOT NULL DEFAULT 0,
      allocated_at TEXT NOT NULL,
      converted_at TEXT,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
      UNIQUE(experiment_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS funnel_events (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_funnel_events_customer ON funnel_events(customer_id, stage);
    CREATE INDEX IF NOT EXISTS idx_funnel_events_stage ON funnel_events(stage);

    CREATE TABLE IF NOT EXISTS payment_ledger (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      stripe_event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      status TEXT NOT NULL,
      invoice_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_payment_ledger_customer ON payment_ledger(customer_id);

    CREATE TABLE IF NOT EXISTS processed_webhooks (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      processed_at TEXT NOT NULL
    );
  `);
}

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

export function seedDatabase(db: DatabaseSync): void {
  const check = db.prepare('SELECT COUNT(*) as count FROM experiments;').get() as { count: number };
  if (check.count > 0) return;

  const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const past3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const past1d = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Seed Experiments
  const insertExp = db.prepare(`
    INSERT INTO experiments (id, key, name, description, status, target_metric, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `);
  const insertVariant = db.prepare(`
    INSERT INTO variants (id, experiment_id, key, name, weight, visitors, conversions)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `);

  const exp1Id = crypto.randomUUID();
  insertExp.run(
    exp1Id,
    'onboarding_flow_v2',
    '3-Step Guided Wizard vs Single Page',
    'Tests whether a progressive 3-step onboarding wizard lifts customer activation over the legacy 1-page form.',
    'running',
    'Activation Rate',
    past7d
  );
  insertVariant.run(crypto.randomUUID(), exp1Id, 'control', 'Single Page (Control)', 50, 150, 31);
  insertVariant.run(crypto.randomUUID(), exp1Id, 'variant_a', '3-Step Wizard (Treatment)', 50, 150, 52);

  const exp2Id = crypto.randomUUID();
  insertExp.run(
    exp2Id,
    'checkout_cta_copy',
    'Urgency Badge vs Money-Back Guarantee',
    'Evaluate conversion lift of adding a 30-day money-back guarantee badge next to the Stripe checkout CTA button.',
    'running',
    'Checkout Conversion',
    past3d
  );
  insertVariant.run(crypto.randomUUID(), exp2Id, 'control', 'Urgency Badge', 50, 95, 14);
  insertVariant.run(crypto.randomUUID(), exp2Id, 'variant_a', 'Guarantee Badge', 50, 95, 22);

  // 2. Seed Customers
  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, email, name, status, mrr_cents, created_at)
    VALUES (?, ?, ?, ?, ?, ?);
  `);

  const c1 = crypto.randomUUID();
  const c2 = crypto.randomUUID();
  const c3 = crypto.randomUUID();
  const c4 = crypto.randomUUID();
  const c5 = crypto.randomUUID();
  const c6 = crypto.randomUUID();

  insertCustomer.run(c1, 'kristjan.k@tallinntech.ee', 'Kristjan Kallas', 'active', 9900, past7d);
  insertCustomer.run(c2, 'laura.t@nordicdev.com', 'Laura Tamm', 'active', 14900, past7d);
  insertCustomer.run(c3, 'marko.p@tartuventures.ee', 'Marko Paju', 'trial', 0, past3d);
  insertCustomer.run(c4, 'anna.s@balticscale.io', 'Anna Sepp', 'active', 4900, past3d);
  insertCustomer.run(c5, 'erik.m@helsinkisoft.fi', 'Erik Mäki', 'lead', 0, past1d);
  insertCustomer.run(c6, 'liis.r@pärnutech.ee', 'Liis Raud', 'churned', 0, past7d);

  // 3. Seed Funnel Events
  const insertEvent = db.prepare(`
    INSERT INTO funnel_events (id, customer_id, stage, metadata, created_at)
    VALUES (?, ?, ?, ?, ?);
  `);

  const stages = [
    { c: c1, steps: ['visited', 'onboarded', 'activated', 'trial_started', 'converted_paid'] },
    { c: c2, steps: ['visited', 'onboarded', 'activated', 'trial_started', 'converted_paid'] },
    { c: c3, steps: ['visited', 'onboarded', 'activated', 'trial_started'] },
    { c: c4, steps: ['visited', 'onboarded', 'activated', 'trial_started', 'converted_paid'] },
    { c: c5, steps: ['visited', 'onboarded'] },
    { c: c6, steps: ['visited', 'onboarded', 'activated', 'trial_started', 'converted_paid'] },
  ];

  for (const s of stages) {
    for (const step of s.steps) {
      insertEvent.run(
        crypto.randomUUID(),
        s.c,
        step,
        JSON.stringify({ userAgent: 'Mozilla/5.0 Chrome/128', ref: 'direct' }),
        past3d
      );
    }
  }

  // 4. Seed Payment Ledger & Processed Webhooks
  const insertLedger = db.prepare(`
    INSERT INTO payment_ledger (
      id, customer_id, stripe_event_id, event_type, amount_cents, currency, status, invoice_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  const insertWebhook = db.prepare(`
    INSERT INTO processed_webhooks (id, event_type, status, processed_at)
    VALUES (?, ?, ?, ?);
  `);

  const evt1 = 'evt_3M_seed_charge_01';
  insertLedger.run(crypto.randomUUID(), c1, evt1, 'payment_intent.succeeded', 9900, 'EUR', 'settled', 'in_9901_tallinn', past7d);
  insertWebhook.run(evt1, 'payment_intent.succeeded', 'reconciled', past7d);

  const evt2 = 'evt_3M_seed_charge_02';
  insertLedger.run(crypto.randomUUID(), c2, evt2, 'payment_intent.succeeded', 14900, 'EUR', 'settled', 'in_9902_nordic', past7d);
  insertWebhook.run(evt2, 'payment_intent.succeeded', 'reconciled', past7d);

  const evt3 = 'evt_3M_seed_charge_03';
  insertLedger.run(crypto.randomUUID(), c4, evt3, 'payment_intent.succeeded', 4900, 'EUR', 'settled', 'in_9903_baltic', past3d);
  insertWebhook.run(evt3, 'payment_intent.succeeded', 'reconciled', past3d);
}

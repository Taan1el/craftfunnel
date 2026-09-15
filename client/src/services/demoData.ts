// Fixed seed data for the in-browser demo, mirroring the shape and scale of
// server/src/db/seed.ts, but with fixed ids and timestamps instead of
// crypto.randomUUID() and relative-to-now dates, so the demo (and its
// screenshots) come out the same on every load.
import type { Customer, FunnelStage, PaymentLedgerEntry } from '../../../shared/types.js';

export const DEMO_TIMESTAMPS = {
  past7d: '2026-09-08T09:00:00.000Z',
  past3d: '2026-09-12T09:00:00.000Z',
  past1d: '2026-09-14T09:00:00.000Z',
};

export interface DemoVariantSeed {
  id: string;
  key: string;
  name: string;
  weight: number;
  visitors: number;
  conversions: number;
}

export interface DemoExperimentSeed {
  id: string;
  key: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed';
  target_metric: string;
  created_at: string;
  variants: DemoVariantSeed[];
}

export function createSeedExperiments(): DemoExperimentSeed[] {
  return [
    {
      id: 'demo-exp-1',
      key: 'onboarding_flow_v2',
      name: '3-Step Guided Wizard vs Single Page',
      description:
        'Tests whether a progressive 3-step onboarding wizard lifts customer activation over the legacy 1-page form.',
      status: 'running',
      target_metric: 'Activation Rate',
      created_at: DEMO_TIMESTAMPS.past7d,
      variants: [
        { id: 'demo-var-1a', key: 'control', name: 'Single Page (Control)', weight: 50, visitors: 150, conversions: 31 },
        { id: 'demo-var-1b', key: 'variant_a', name: '3-Step Wizard (Treatment)', weight: 50, visitors: 150, conversions: 52 },
      ],
    },
    {
      id: 'demo-exp-2',
      key: 'checkout_cta_copy',
      name: 'Urgency Badge vs Money-Back Guarantee',
      description:
        'Evaluate conversion lift of adding a 30-day money-back guarantee badge next to the Stripe checkout CTA button.',
      status: 'running',
      target_metric: 'Checkout Conversion',
      created_at: DEMO_TIMESTAMPS.past3d,
      variants: [
        { id: 'demo-var-2a', key: 'control', name: 'Urgency Badge', weight: 50, visitors: 95, conversions: 14 },
        { id: 'demo-var-2b', key: 'variant_a', name: 'Guarantee Badge', weight: 50, visitors: 95, conversions: 22 },
      ],
    },
  ];
}

export function createSeedCustomers(): Customer[] {
  return [
    {
      id: 'demo-cust-1',
      email: 'kristjan.k@tallinntech.ee',
      name: 'Kristjan Kallas',
      status: 'active',
      mrr_cents: 9900,
      created_at: DEMO_TIMESTAMPS.past7d,
    },
    {
      id: 'demo-cust-2',
      email: 'laura.t@nordicdev.com',
      name: 'Laura Tamm',
      status: 'active',
      mrr_cents: 14900,
      created_at: DEMO_TIMESTAMPS.past7d,
    },
    {
      id: 'demo-cust-3',
      email: 'marko.p@tartuventures.ee',
      name: 'Marko Paju',
      status: 'trial',
      mrr_cents: 0,
      created_at: DEMO_TIMESTAMPS.past3d,
    },
    {
      id: 'demo-cust-4',
      email: 'anna.s@balticscale.io',
      name: 'Anna Sepp',
      status: 'active',
      mrr_cents: 4900,
      created_at: DEMO_TIMESTAMPS.past3d,
    },
    {
      id: 'demo-cust-5',
      email: 'erik.m@helsinkisoft.fi',
      name: 'Erik Mäki',
      status: 'lead',
      mrr_cents: 0,
      created_at: DEMO_TIMESTAMPS.past1d,
    },
    {
      id: 'demo-cust-6',
      email: 'liis.r@parnutech.ee',
      name: 'Liis Raud',
      status: 'churned',
      mrr_cents: 0,
      created_at: DEMO_TIMESTAMPS.past7d,
    },
  ];
}

export interface DemoFunnelEventSeed {
  id: string;
  customer_id: string;
  stage: FunnelStage;
  created_at: string;
}

export function createSeedFunnelEvents(): DemoFunnelEventSeed[] {
  const plans: { customerId: string; steps: FunnelStage[] }[] = [
    { customerId: 'demo-cust-1', steps: ['visited', 'onboarded', 'activated', 'trial_started', 'converted_paid'] },
    { customerId: 'demo-cust-2', steps: ['visited', 'onboarded', 'activated', 'trial_started', 'converted_paid'] },
    { customerId: 'demo-cust-3', steps: ['visited', 'onboarded', 'activated', 'trial_started'] },
    { customerId: 'demo-cust-4', steps: ['visited', 'onboarded', 'activated', 'trial_started', 'converted_paid'] },
    { customerId: 'demo-cust-5', steps: ['visited', 'onboarded'] },
    { customerId: 'demo-cust-6', steps: ['visited', 'onboarded', 'activated', 'trial_started', 'converted_paid'] },
  ];

  const events: DemoFunnelEventSeed[] = [];
  let counter = 0;
  for (const plan of plans) {
    for (const stage of plan.steps) {
      counter += 1;
      events.push({ id: `demo-evt-${counter}`, customer_id: plan.customerId, stage, created_at: DEMO_TIMESTAMPS.past3d });
    }
  }
  return events;
}

export function createSeedLedger(): PaymentLedgerEntry[] {
  return [
    {
      id: 'demo-ledger-1',
      customer_id: 'demo-cust-1',
      customer_email: 'kristjan.k@tallinntech.ee',
      stripe_event_id: 'evt_3M_seed_charge_01',
      event_type: 'payment_intent.succeeded',
      amount_cents: 9900,
      currency: 'EUR',
      status: 'settled',
      invoice_id: 'in_9901_tallinn',
      created_at: DEMO_TIMESTAMPS.past7d,
    },
    {
      id: 'demo-ledger-2',
      customer_id: 'demo-cust-2',
      customer_email: 'laura.t@nordicdev.com',
      stripe_event_id: 'evt_3M_seed_charge_02',
      event_type: 'payment_intent.succeeded',
      amount_cents: 14900,
      currency: 'EUR',
      status: 'settled',
      invoice_id: 'in_9902_nordic',
      created_at: DEMO_TIMESTAMPS.past7d,
    },
    {
      id: 'demo-ledger-3',
      customer_id: 'demo-cust-4',
      customer_email: 'anna.s@balticscale.io',
      stripe_event_id: 'evt_3M_seed_charge_03',
      event_type: 'payment_intent.succeeded',
      amount_cents: 4900,
      currency: 'EUR',
      status: 'settled',
      invoice_id: 'in_9903_baltic',
      created_at: DEMO_TIMESTAMPS.past3d,
    },
  ];
}

export const SEED_PROCESSED_WEBHOOK_IDS = ['evt_3M_seed_charge_01', 'evt_3M_seed_charge_02', 'evt_3M_seed_charge_03'];

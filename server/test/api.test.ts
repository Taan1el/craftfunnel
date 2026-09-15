import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp, AppContext } from '../src/app.js';

describe('CraftFunnel API & Growth Engine Tests', () => {
  let ctx: AppContext;

  beforeEach(() => {
    ctx = createApp(':memory:', true);
  });

  describe('System Health & Growth Telemetry', () => {
    it('GET /api/health returns operational status', async () => {
      const res = await request(ctx.app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('craftfunnel-api');
    });

    it('GET /api/payments/metrics returns MRR, ARPU, and subscriber counts', async () => {
      const res = await request(ctx.app).get('/api/payments/metrics');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('mrr_eur');
      expect(res.body.data).toHaveProperty('active_subscribers');
      expect(res.body.data).toHaveProperty('arpu_eur');
      expect(res.body.data.active_subscribers).toBeGreaterThan(0);
    });
  });

  describe('A/B Testing & Deterministic Allocations', () => {
    it('GET /api/experiments returns experiments with statistical Z-scores', async () => {
      const res = await request(ctx.app).get('/api/experiments');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      const exp = res.body.data.find((e: any) => e.key === 'onboarding_flow_v2');
      expect(exp).toBeDefined();
      expect(exp.variants.length).toBe(2);
      expect(exp).toHaveProperty('z_score');
      expect(exp).toHaveProperty('confidence_percentage');
    });

    it('POST /api/experiments/evaluate deterministically assigns variant to user', async () => {
      const payload = {
        experiment_key: 'onboarding_flow_v2',
        user_id: 'usr_determ_test_9921',
      };

      // Call 1
      const res1 = await request(ctx.app).post('/api/experiments/evaluate').send(payload);
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(['control', 'variant_a']).toContain(res1.body.data.variant);
      expect(res1.body.data.isNew).toBe(true);

      const assignedVariant = res1.body.data.variant;

      // Call 2: Exact same user must receive identical variant without isNew flag
      const res2 = await request(ctx.app).post('/api/experiments/evaluate').send(payload);
      expect(res2.status).toBe(200);
      expect(res2.body.data.variant).toBe(assignedVariant);
      expect(res2.body.data.isNew).toBe(false);
    });

    it('POST /api/experiments/convert records conversion idempotently', async () => {
      const payload = {
        experiment_key: 'onboarding_flow_v2',
        user_id: 'usr_conversion_test_55',
      };

      // 1. Allocate
      await request(ctx.app).post('/api/experiments/evaluate').send(payload);

      // 2. Convert (first time returns true)
      const res1 = await request(ctx.app).post('/api/experiments/convert').send(payload);
      expect(res1.status).toBe(200);
      expect(res1.body.data.converted).toBe(true);

      // 3. Convert second time (already converted, returns false to prevent double count)
      const res2 = await request(ctx.app).post('/api/experiments/convert').send(payload);
      expect(res2.status).toBe(200);
      expect(res2.body.data.converted).toBe(false);
    });
  });

  describe('Funnel Analytics', () => {
    it('GET /api/funnel/metrics calculates drop-off rates across stages', async () => {
      const res = await request(ctx.app).get('/api/funnel/metrics');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(5);

      const [step1, step2] = res.body.data;
      expect(step1.stage).toBe('visited');
      expect(step2.stage).toBe('onboarded');
      expect(step1.total_count).toBeGreaterThanOrEqual(step2.total_count);
    });

    it('POST /api/funnel/track records new funnel step', async () => {
      const customersRes = await request(ctx.app).get('/api/customers');
      const customer = customersRes.body.data[0];

      const res = await request(ctx.app).post('/api/funnel/track').send({
        customer_id: customer.id,
        stage: 'activated',
        metadata: { feature: 'project_export' },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Stripe Webhook Reconciliation & Financial Ledger', () => {
    it('processes payment_intent.succeeded, records ledger, and upgrades customer', async () => {
      const customersRes = await request(ctx.app).get('/api/customers');
      const leadCustomer = customersRes.body.data.find((c: any) => c.status === 'lead') || customersRes.body.data[0];
      const initialMrr = leadCustomer.mrr_cents;

      const stripeEventId = 'evt_test_charge_unique_101';
      const webhookPayload = {
        id: stripeEventId,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_101',
            customer: leadCustomer.id,
            amount: 9900,
            currency: 'eur',
            invoice: 'inv_annual_101',
          },
        },
      };

      // 1. Process Webhook
      const res = await request(ctx.app).post('/api/payments/webhook').send(webhookPayload);
      expect(res.status).toBe(200);
      expect(res.body.reconciled).toBe(true);
      expect(res.body.ledger).toBeDefined();
      expect(res.body.ledger.amount_cents).toBe(9900);
      expect(res.body.ledger.status).toBe('settled');

      // 2. Customer MRR increased and status is active
      const updatedCustomerRes = await request(ctx.app).get(`/api/customers/${leadCustomer.id}`);
      expect(updatedCustomerRes.body.data.status).toBe('active');
      expect(updatedCustomerRes.body.data.mrr_cents).toBe(initialMrr + 9900);

      // 3. Idempotency Test: Sending exact same webhook event must be recognized as duplicate
      const dupRes = await request(ctx.app).post('/api/payments/webhook').send(webhookPayload);
      expect(dupRes.status).toBe(200);
      expect(dupRes.body.duplicate).toBe(true);
      expect(dupRes.body.reconciled).toBe(false);

      // Verify MRR was NOT incremented again
      const customerAfterDup = await request(ctx.app).get(`/api/customers/${leadCustomer.id}`);
      expect(customerAfterDup.body.data.mrr_cents).toBe(initialMrr + 9900);
    });

    it('processes charge.refunded and adjusts ledger & MRR', async () => {
      const customersRes = await request(ctx.app).get('/api/customers');
      const activeCustomer = customersRes.body.data.find((c: any) => c.status === 'active');

      const res = await request(ctx.app).post('/api/payments/webhook').send({
        id: 'evt_test_refund_881',
        type: 'charge.refunded',
        data: {
          object: {
            customer: activeCustomer.id,
            amount: 4900,
            currency: 'eur',
          },
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.reconciled).toBe(true);
      expect(res.body.ledger.status).toBe('refunded');
      expect(res.body.ledger.amount_cents).toBe(-4900);
    });

    it('GET /api/payments/ledger returns reconciled audit entries', async () => {
      const res = await request(ctx.app).get('/api/payments/ledger');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data[0]).toHaveProperty('stripe_event_id');
      expect(res.body.data[0]).toHaveProperty('customer_email');
    });

    it('GET /api/customers/:id/timeline returns full lifecycle audit history', async () => {
      const customersRes = await request(ctx.app).get('/api/customers');
      const customer = customersRes.body.data[0];

      const res = await request(ctx.app).get(`/api/customers/${customer.id}/timeline`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('events');
      expect(res.body.data).toHaveProperty('allocations');
      expect(res.body.data).toHaveProperty('ledger');
    });

    it('GET /api/customers/:id/timeline returns 404 for an unknown customer', async () => {
      const res = await request(ctx.app).get('/api/customers/cust_does_not_exist/timeline');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('does not attribute an unresolvable webhook event to an arbitrary customer', async () => {
      const res = await request(ctx.app)
        .post('/api/payments/webhook')
        .send({
          id: 'evt_unknown_customer_1',
          type: 'payment_intent.succeeded',
          data: { object: { customer: 'cust_does_not_exist', amount: 9900 } },
        });

      expect(res.status).toBe(200);
      expect(res.body.reconciled).toBe(false);
      expect(res.body.ledger).toBeUndefined();

      // No ledger entry should have been created for it.
      const ledgerRes = await request(ctx.app).get('/api/payments/ledger');
      expect(ledgerRes.body.data.find((e: any) => e.stripe_event_id === 'evt_unknown_customer_1')).toBeUndefined();
    });

    it('records a genuine $0 amount instead of silently substituting the 9900 default', async () => {
      const customersRes = await request(ctx.app).get('/api/customers');
      const customer = customersRes.body.data[0];

      const res = await request(ctx.app)
        .post('/api/payments/webhook')
        .send({
          id: 'evt_zero_amount_1',
          type: 'payment_intent.succeeded',
          data: { object: { customer: customer.id, amount: 0 } },
        });

      expect(res.status).toBe(200);
      expect(res.body.ledger.amount_cents).toBe(0);
    });
  });

  describe('Input validation', () => {
    it('rejects funnel/track with an unknown stage', async () => {
      const customersRes = await request(ctx.app).get('/api/customers');
      const customer = customersRes.body.data[0];

      const res = await request(ctx.app)
        .post('/api/funnel/track')
        .send({ customer_id: customer.id, stage: 'became_a_wizard' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeTruthy();
    });

    it('rejects experiments/evaluate with a non-string user_id', async () => {
      const res = await request(ctx.app)
        .post('/api/experiments/evaluate')
        .send({ experiment_key: 'onboarding_flow_v2', user_id: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 (not a leaked stack trace) for evaluating an unknown experiment', async () => {
      const res = await request(ctx.app)
        .post('/api/experiments/evaluate')
        .send({ experiment_key: 'does_not_exist', user_id: 'usr_1' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('does_not_exist');
    });

    it('rejects payments/simulate without a customer_id', async () => {
      const res = await request(ctx.app).post('/api/payments/simulate').send({ event_type: 'payment_intent.succeeded' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects payments/simulate with an unsupported event_type', async () => {
      const customersRes = await request(ctx.app).get('/api/customers');
      const customer = customersRes.body.data[0];

      const res = await request(ctx.app)
        .post('/api/payments/simulate')
        .send({ event_type: 'account.updated', customer_id: customer.id });

      expect(res.status).toBe(400);
    });

    it('rejects payments/simulate with a non-positive amount_cents', async () => {
      const customersRes = await request(ctx.app).get('/api/customers');
      const customer = customersRes.body.data[0];

      const res = await request(ctx.app)
        .post('/api/payments/simulate')
        .send({ customer_id: customer.id, amount_cents: -500 });

      expect(res.status).toBe(400);
    });

    it('returns a plain 404 JSON body for an unknown API route instead of the SPA fallback', async () => {
      const res = await request(ctx.app).get('/api/totally-made-up-route');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, error: 'Not found' });
    });
  });

  describe('Empty-state funnel analytics', () => {
    it('reports zeroed-out metrics instead of crashing when there is no data at all', async () => {
      const emptyCtx = createApp(':memory:', false);
      const res = await request(emptyCtx.app).get('/api/funnel/metrics');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
      for (const step of res.body.data) {
        expect(step.total_count).toBe(0);
        expect(step.conversion_rate_from_first).toBe(0);
        expect(step.dropoff_rate).toBe(0);
      }
    });

    it('reports zeroed-out growth metrics with no customers or funnel events', async () => {
      const emptyCtx = createApp(':memory:', false);
      const res = await request(emptyCtx.app).get('/api/payments/metrics');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        mrr_eur: 0,
        total_customers: 0,
        active_subscribers: 0,
        funnel_conversion_rate: 0,
        arpu_eur: 0,
      });
    });
  });
});

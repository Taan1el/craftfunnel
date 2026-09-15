import { describe, it, expect, beforeEach } from 'vitest';
import { demoApi, resetDemoData } from '../services/demoApi.js';

// The demo adapter is the entire data layer on GitHub Pages (no API server
// exists there), so it gets the same kind of coverage the real API's
// integration tests get: seeded data, deterministic allocation, idempotent
// webhook reconciliation, validation, and reset.
describe('demoApi (in-browser data layer)', () => {
  beforeEach(() => {
    resetDemoData();
  });

  it('starts from the seeded customer and experiment catalog', async () => {
    const customers = await demoApi.getCustomers();
    expect(customers).toHaveLength(6);
    expect(customers.map((c) => c.email)).toContain('kristjan.k@tallinntech.ee');

    const experiments = await demoApi.getExperiments();
    expect(experiments).toHaveLength(2);
    const onboarding = experiments.find((e) => e.key === 'onboarding_flow_v2');
    expect(onboarding?.variants).toHaveLength(2);
  });

  it('computes funnel metrics with the same drop-off math as the server', async () => {
    const funnel = await demoApi.getFunnel();
    expect(funnel).toHaveLength(5);
    expect(funnel[0].stage).toBe('visited');
    expect(funnel[0].total_count).toBe(6);
    // Only 'erik' and 'marko' (trial, lead) never reach converted_paid; 4 of
    // 6 seeded customers do.
    expect(funnel[4].stage).toBe('converted_paid');
    expect(funnel[4].total_count).toBe(4);
    expect(funnel.every((step) => step.dropoff_rate >= 0)).toBe(true);
  });

  it('reports growth metrics consistent with the seeded customers', async () => {
    const metrics = await demoApi.getMetrics();
    // active: Kristjan (9900), Laura (14900), Anna (4900) = 29700 cents
    expect(metrics.mrr_eur).toBe(297);
    expect(metrics.active_subscribers).toBe(3);
    expect(metrics.total_customers).toBe(6);
  });

  it('deterministically assigns the same variant to the same user on repeat evaluation', async () => {
    const first = await demoApi.evaluateExperiment('onboarding_flow_v2', 'usr_demo_test_1');
    expect(first.isNew).toBe(true);
    expect(['control', 'variant_a']).toContain(first.variant);

    const second = await demoApi.evaluateExperiment('onboarding_flow_v2', 'usr_demo_test_1');
    expect(second.isNew).toBe(false);
    expect(second.variant).toBe(first.variant);
  });

  it('throws a not-found error for an unknown experiment, matching the real API message', async () => {
    await expect(demoApi.evaluateExperiment('does_not_exist', 'usr_1')).rejects.toThrow(
      "Experiment 'does_not_exist' not found"
    );
  });

  it('records a conversion once and rejects a second conversion for the same user', async () => {
    await demoApi.evaluateExperiment('checkout_cta_copy', 'usr_demo_convert');
    const first = await demoApi.convertExperiment('checkout_cta_copy', 'usr_demo_convert');
    expect(first.converted).toBe(true);

    const second = await demoApi.convertExperiment('checkout_cta_copy', 'usr_demo_convert');
    expect(second.converted).toBe(false);
  });

  it('reconciles a simulated webhook and updates customer MRR and status', async () => {
    const customers = await demoApi.getCustomers();
    const lead = customers.find((c) => c.status === 'lead')!;

    const res = await demoApi.simulateWebhook({
      event_type: 'payment_intent.succeeded',
      customer_id: lead.id,
      amount_cents: 5000,
    });

    expect(res.reconciled).toBe(true);
    expect(res.ledger.amount_cents).toBe(5000);
    expect(res.ledger.status).toBe('settled');

    const updated = (await demoApi.getCustomers()).find((c) => c.id === lead.id)!;
    expect(updated.status).toBe('active');
    expect(updated.mrr_cents).toBe(5000);
  });

  it('recognizes a repeated idempotency key as a duplicate and does not double-charge', async () => {
    const [customer] = await demoApi.getCustomers();
    const dto = { event_type: 'payment_intent.succeeded', customer_id: customer.id, amount_cents: 2500, idempotency_key: 'evt_fixed_key' };

    const first = await demoApi.simulateWebhook(dto);
    expect(first.duplicate).toBe(false);

    const second = await demoApi.simulateWebhook(dto);
    expect(second.duplicate).toBe(true);
    expect(second.reconciled).toBe(false);
  });

  it('rejects a simulated webhook with no customer_id', async () => {
    await expect(demoApi.simulateWebhook({ event_type: 'payment_intent.succeeded' })).rejects.toThrow('customer_id');
  });

  it('rejects a simulated webhook with an unsupported event_type', async () => {
    const [customer] = await demoApi.getCustomers();
    await expect(
      demoApi.simulateWebhook({ event_type: 'account.updated', customer_id: customer.id })
    ).rejects.toThrow('event_type');
  });

  it('returns a customer timeline with events, allocations and ledger entries', async () => {
    const customers = await demoApi.getCustomers();
    const kristjan = customers.find((c) => c.email === 'kristjan.k@tallinntech.ee')!;

    const timeline = await demoApi.getCustomerTimeline(kristjan.id);
    expect(timeline.events.length).toBeGreaterThan(0);
    expect(timeline.ledger.length).toBeGreaterThan(0);
  });

  it('resetDemoData restores the original seed after mutations', async () => {
    await demoApi.evaluateExperiment('onboarding_flow_v2', 'usr_temp');
    const [customer] = await demoApi.getCustomers();
    await demoApi.simulateWebhook({ event_type: 'payment_intent.succeeded', customer_id: customer.id, amount_cents: 100 });

    resetDemoData();

    const customers = await demoApi.getCustomers();
    expect(customers).toHaveLength(6);
    const metrics = await demoApi.getMetrics();
    expect(metrics.mrr_eur).toBe(297);
  });
});

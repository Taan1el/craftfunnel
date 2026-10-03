import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from './axe';
import { App } from '../App';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getMetrics: vi.fn(),
    getFunnel: vi.fn(),
    getExperiments: vi.fn(),
    getLedger: vi.fn(),
    getCustomers: vi.fn(),
    getCustomerTimeline: vi.fn(),
    evaluateExperiment: vi.fn(),
    convertExperiment: vi.fn(),
    simulateWebhook: vi.fn(),
  },
}));

describe('Accessibility checks', () => {
  const mockMetrics = {
    mrr_eur: 297,
    total_customers: 6,
    active_subscribers: 3,
    funnel_conversion_rate: 33.3,
    arpu_eur: 99.0,
  };

  const mockFunnel = [
    { stage: 'visited' as const, label: '1. Landing Page Visit', total_count: 6, conversion_rate_from_first: 100, dropoff_rate: 0 },
    { stage: 'onboarded' as const, label: '2. Profile Setup & Onboarding', total_count: 6, conversion_rate_from_first: 100, dropoff_rate: 0 },
    { stage: 'activated' as const, label: '3. Core Feature Activation', total_count: 5, conversion_rate_from_first: 83.3, dropoff_rate: 16.7 },
    { stage: 'trial_started' as const, label: '4. Free Trial Initiated', total_count: 5, conversion_rate_from_first: 83.3, dropoff_rate: 0 },
    { stage: 'converted_paid' as const, label: '5. Paid Subscription', total_count: 4, conversion_rate_from_first: 66.7, dropoff_rate: 20 },
  ];

  const mockExperiments = [
    {
      id: 'exp-1',
      key: 'onboarding_flow_v2',
      name: '3-Step Guided Wizard vs Single Page',
      description: 'Tests progressive onboarding wizard against 1-page form',
      status: 'running' as const,
      target_metric: 'Activation Rate',
      created_at: new Date().toISOString(),
      variants: [
        { id: 'v-1', experiment_id: 'exp-1', key: 'control', name: 'Single Page (Control)', weight: 50, visitors: 150, conversions: 31, conversion_rate: 20.7 },
        { id: 'v-2', experiment_id: 'exp-1', key: 'variant_a', name: '3-Step Wizard (Treatment)', weight: 50, visitors: 150, conversions: 52, conversion_rate: 34.7 },
      ],
      z_score: 2.71,
      confidence_percentage: 99.7,
      is_significant: true,
    },
  ];

  const mockCustomers = [
    {
      id: 'cust-1',
      name: 'Kristjan Kallas',
      email: 'kristjan.k@tallinntech.ee',
      status: 'active' as const,
      mrr_cents: 9900,
      created_at: new Date().toISOString(),
    },
    {
      id: 'cust-2',
      name: 'Laura Tamm',
      email: 'laura.t@nordicdev.com',
      status: 'active' as const,
      mrr_cents: 14900,
      created_at: new Date().toISOString(),
    },
  ];

  const mockLedger = [
    {
      id: 'led-1',
      customer_id: 'cust-1',
      customer_email: 'kristjan.k@tallinntech.ee',
      stripe_event_id: 'evt_stripe_test_1',
      event_type: 'payment_intent.succeeded',
      amount_cents: 9900,
      currency: 'EUR',
      status: 'settled' as const,
      invoice_id: 'in_9901',
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getMetrics).mockResolvedValue(mockMetrics);
    vi.mocked(api.getFunnel).mockResolvedValue(mockFunnel);
    vi.mocked(api.getExperiments).mockResolvedValue(mockExperiments);
    vi.mocked(api.getCustomers).mockResolvedValue(mockCustomers);
    vi.mocked(api.getLedger).mockResolvedValue(mockLedger);
  });

  async function renderLoaded() {
    const result = render(<App />);
    await screen.findByText('\u20ac297');
    await screen.findByText('1. Landing Page Visit');
    return result;
  }

  it('funnel view has no violations', async () => {
    const { container } = await renderLoaded();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('experiments tab has no violations', async () => {
    const { container } = await renderLoaded();
    await userEvent.click(screen.getByRole('tab', { name: /Experiments/ }));
    await screen.findByRole('tabpanel');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('billing tab has no violations', async () => {
    const { container } = await renderLoaded();
    await userEvent.click(screen.getByRole('tab', { name: /Billing/ }));
    await screen.findByText('Payment ledger');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('customers tab has no violations', async () => {
    const { container } = await renderLoaded();
    await userEvent.click(screen.getByRole('tab', { name: /customers/i }));
    await screen.findByText('Kristjan Kallas');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('customer drawer has no violations', async () => {
    vi.mocked(api.getCustomerTimeline).mockResolvedValue({
      events: [{ id: 'ev-1', stage: 'visited', created_at: new Date().toISOString() }],
      allocations: [
        { id: 'al-1', experiment_name: 'Wizard', experiment_key: 'onboarding_flow_v2', variant_key: 'control', converted: true },
      ],
      ledger: [
        { id: 'led-1', created_at: new Date().toISOString(), event_type: 'payment_intent.succeeded', amount_cents: 9900, status: 'settled' },
      ],
    });
    const { container } = await renderLoaded();
    await userEvent.click(screen.getByRole('tab', { name: /customers/i }));
    await userEvent.click(await screen.findByText('Kristjan Kallas'));
    await screen.findByRole('dialog');
    expect(await axe(document.body)).toHaveNoViolations();
    expect(container).toBeInTheDocument();
  });
});

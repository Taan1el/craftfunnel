import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('CraftFunnel Frontend Dashboard', () => {
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

  it('renders brand heading and growth metrics cards', async () => {
    render(<App />);

    expect(screen.getByText('CraftFunnel')).toBeInTheDocument();
    expect(screen.getByText('SaaS Growth Engine, A/B Testing Allocator & Stripe Reconciliation')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('€297')).toBeInTheDocument(); // MRR
      expect(screen.getByText('€99')).toBeInTheDocument(); // ARPU
    });
  });

  it('renders acquisition funnel visualizer with step dropoffs', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('SaaS Customer Acquisition Funnel')).toBeInTheDocument();
      expect(screen.getByText('1. Landing Page Visit')).toBeInTheDocument();
      expect(screen.getAllByText('5. Paid Subscription').length).toBeGreaterThan(0);
    });
  });

  it('renders A/B experiment card with statistical significance', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('3-Step Guided Wizard vs Single Page')).toBeInTheDocument();
      expect(screen.getByText('🏆 Statistically Significant (>95%)')).toBeInTheDocument();
      expect(screen.getByText('2.71')).toBeInTheDocument(); // Z-score
    });
  });

  it('switches to Stripe Webhooks tab and renders reconciliation simulator and ledger', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Stripe Webhooks & Ledger/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Stripe Webhooks & Ledger/i));

    await waitFor(() => {
      expect(screen.getByText('Stripe Webhook & Financial Reconciliation Simulator')).toBeInTheDocument();
      expect(screen.getByText('Financial Transaction Ledger')).toBeInTheDocument();
      expect(screen.getByText('+€99.00')).toBeInTheDocument();
    });
  });

  it('switches to Customers tab and displays customer directory', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Customers & Lifecycle/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Customers & Lifecycle/i));

    await waitFor(() => {
      expect(screen.getByText('Kristjan Kallas')).toBeInTheDocument();
      expect(screen.getByText('laura.t@nordicdev.com')).toBeInTheDocument();
    });
  });
});

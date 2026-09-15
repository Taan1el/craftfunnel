import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WebhookSimulator } from '../components/WebhookSimulator';
import { api } from '../services/index.js';

vi.mock('../services/index.js', async () => {
  const actual = await vi.importActual<typeof import('../services/index.js')>('../services/index.js');
  return {
    ...actual,
    api: { ...actual.api, simulateWebhook: vi.fn() },
  };
});

describe('WebhookSimulator', () => {
  const customer = {
    id: 'cust-1',
    name: 'Kristjan Kallas',
    email: 'kristjan.k@tallinntech.ee',
    status: 'active' as const,
    mrr_cents: 9900,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state instead of a broken form when there are no customers', () => {
    render(<WebhookSimulator customers={[]} onReconciliationComplete={() => {}} />);
    expect(screen.getByText(/No customers yet/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Stripe Event Type/i)).not.toBeInTheDocument();
  });

  it('rejects a non-positive amount before calling the API', async () => {
    render(<WebhookSimulator customers={[customer]} onReconciliationComplete={() => {}} />);

    // An explicit "0" is blocked by the input's own min="1" constraint before
    // the form's submit handler even runs (jsdom enforces the native HTML5
    // constraint the same way a real browser does); clearing the field
    // entirely is the realistic way a non-positive amount reaches the
    // component's own validation, since an empty, non-required number input
    // passes native constraint validation.
    const amountInput = screen.getByLabelText(/Amount \(EUR\)/i);
    fireEvent.change(amountInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Fire Stripe Webhook/i }));

    await waitFor(() => {
      expect(screen.getByText(/Amount must be a positive number/i)).toBeInTheDocument();
    });
    expect(api.simulateWebhook).not.toHaveBeenCalled();
  });

  it('submits a webhook and reports success', async () => {
    vi.mocked(api.simulateWebhook).mockResolvedValue({
      success: true,
      eventId: 'evt_1',
      reconciled: true,
      duplicate: false,
      ledger: { id: 'ledger-123', status: 'settled' },
    });
    const onComplete = vi.fn();

    render(<WebhookSimulator customers={[customer]} onReconciliationComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /Fire Stripe Webhook/i }));

    await waitFor(() => {
      expect(screen.getByText(/Successfully reconciled/i)).toBeInTheDocument();
    });
    expect(api.simulateWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: 'cust-1', amount_cents: 9900 })
    );
    expect(onComplete).toHaveBeenCalled();
  });
});

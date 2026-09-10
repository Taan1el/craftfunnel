import type {
  ApiResponse,
  Customer,
  Experiment,
  FunnelStepMetric,
  GrowthMetrics,
  PaymentLedgerEntry,
} from '../../../shared/types';

const API_BASE = '/api';

export const api = {
  async getMetrics(): Promise<GrowthMetrics> {
    const res = await fetch(`${API_BASE}/payments/metrics`);
    const json: ApiResponse<GrowthMetrics> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch metrics');
    return json.data;
  },

  async getFunnel(): Promise<FunnelStepMetric[]> {
    const res = await fetch(`${API_BASE}/funnel/metrics`);
    const json: ApiResponse<FunnelStepMetric[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch funnel');
    return json.data;
  },

  async getExperiments(): Promise<Experiment[]> {
    const res = await fetch(`${API_BASE}/experiments`);
    const json: ApiResponse<Experiment[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch experiments');
    return json.data;
  },

  async evaluateExperiment(experimentKey: string, userId: string): Promise<{ variant: string; isNew: boolean }> {
    const res = await fetch(`${API_BASE}/experiments/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiment_key: experimentKey, user_id: userId }),
    });
    const json = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Evaluation failed');
    return json.data;
  },

  async convertExperiment(experimentKey: string, userId: string): Promise<{ converted: boolean }> {
    const res = await fetch(`${API_BASE}/experiments/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiment_key: experimentKey, user_id: userId }),
    });
    const json = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Conversion failed');
    return json.data;
  },

  async getLedger(): Promise<PaymentLedgerEntry[]> {
    const res = await fetch(`${API_BASE}/payments/ledger`);
    const json: ApiResponse<PaymentLedgerEntry[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch ledger');
    return json.data;
  },

  async simulateWebhook(dto: {
    event_type: string;
    customer_id?: string;
    amount_cents?: number;
    idempotency_key?: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/payments/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Simulation failed');
    return json;
  },

  async getCustomers(): Promise<Customer[]> {
    const res = await fetch(`${API_BASE}/customers`);
    const json: ApiResponse<Customer[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch customers');
    return json.data;
  },

  async getCustomerTimeline(id: string): Promise<{ events: any[]; allocations: any[]; ledger: any[] }> {
    const res = await fetch(`${API_BASE}/customers/${id}/timeline`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch timeline');
    return json.data;
  },
};

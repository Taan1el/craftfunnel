export type CustomerStatus = 'lead' | 'trial' | 'active' | 'churned';

export interface Customer {
  id: string;
  email: string;
  name: string;
  status: CustomerStatus;
  mrr_cents: number;
  created_at: string;
}

export type ExperimentStatus = 'draft' | 'running' | 'completed';

export interface Variant {
  id: string;
  experiment_id: string;
  key: string;
  name: string;
  weight: number;
  visitors: number;
  conversions: number;
  conversion_rate: number;
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  target_metric: string;
  created_at: string;
  variants: Variant[];
  z_score?: number | null;
  confidence_percentage?: number | null;
  is_significant?: boolean;
}

export type FunnelStage = 'visited' | 'onboarded' | 'activated' | 'trial_started' | 'converted_paid';

export interface FunnelStepMetric {
  stage: FunnelStage;
  label: string;
  total_count: number;
  conversion_rate_from_first: number;
  dropoff_rate: number;
}

export interface PaymentLedgerEntry {
  id: string;
  customer_id: string;
  customer_email?: string;
  stripe_event_id: string;
  event_type: string;
  amount_cents: number;
  currency: string;
  status: 'settled' | 'failed' | 'refunded';
  invoice_id?: string | null;
  created_at: string;
}

export interface GrowthMetrics {
  mrr_eur: number;
  total_customers: number;
  active_subscribers: number;
  funnel_conversion_rate: number;
  arpu_eur: number;
}

export interface EvaluateExperimentDto {
  experiment_key: string;
  user_id: string;
}

export interface TrackFunnelEventDto {
  customer_id: string;
  stage: FunnelStage;
  metadata?: Record<string, unknown>;
}

export const STRIPE_EVENT_TYPES = ['payment_intent.succeeded', 'invoice.payment_failed', 'charge.refunded'] as const;
export type StripeEventType = (typeof STRIPE_EVENT_TYPES)[number];

export interface SimulateStripeWebhookDto {
  event_type: StripeEventType;
  customer_id?: string;
  amount_cents?: number;
  idempotency_key?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

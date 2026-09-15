// In-browser stand-in for services/api.ts, used on the GitHub Pages build
// (import.meta.env.VITE_DEMO_MODE === 'true') where there is no Express API
// to call. Implements the same methods as `api` in api.ts against an
// in-memory store seeded with fixed demo data, reusing the exact funnel and
// experiment math the server uses (shared/funnel-logic.ts,
// shared/experiment-logic.ts) so it produces the same numbers the real API
// would for the same inputs. See services/index.ts for the switch between
// the two.
import type {
  Customer,
  Experiment,
  FunnelStepMetric,
  GrowthMetrics,
  PaymentLedgerEntry,
  StripeEventType,
  Variant,
} from '../../../shared/types.js';
import { STRIPE_EVENT_TYPES } from '../../../shared/types.js';
import { computeFunnelMetrics, FUNNEL_STAGES } from '../../../shared/funnel-logic.js';
import { allocateVariant, computeSignificance } from '../../../shared/experiment-logic.js';
import { ratioToPercentage, roundTo1dp } from '../../../shared/format.js';
import {
  createSeedCustomers,
  createSeedExperiments,
  createSeedFunnelEvents,
  createSeedLedger,
  SEED_PROCESSED_WEBHOOK_IDS,
  DemoExperimentSeed,
  DemoFunnelEventSeed,
} from './demoData.js';

const SIMULATABLE_EVENT_TYPES = new Set<string>(STRIPE_EVENT_TYPES);

interface Allocation {
  experiment_id: string;
  user_id: string;
  variant_key: string;
  converted: boolean;
  allocated_at: string;
  converted_at: string | null;
}

let customers: Customer[] = [];
let experiments: DemoExperimentSeed[] = [];
let funnelEvents: DemoFunnelEventSeed[] = [];
let ledger: PaymentLedgerEntry[] = [];
let processedWebhookIds: Set<string> = new Set();
let allocations: Map<string, Allocation> = new Map();
let idCounter = 0;

function freshId(prefix: string): string {
  idCounter += 1;
  return `demo-${prefix}-${idCounter}`;
}

function seed(): void {
  customers = createSeedCustomers();
  experiments = createSeedExperiments();
  funnelEvents = createSeedFunnelEvents();
  ledger = createSeedLedger();
  processedWebhookIds = new Set(SEED_PROCESSED_WEBHOOK_IDS);
  allocations = new Map();
  idCounter = 0;
}

seed();

/**
 * Wipes all demo state and reseeds it, the same way restarting the real
 * server (with a fresh database) would. Only meaningful in demo mode; the
 * real API has no browser-triggerable equivalent, so the demo banner is the
 * only caller.
 */
export function resetDemoData(): void {
  seed();
}

function allocationKey(experimentId: string, userId: string): string {
  return `${experimentId}:${userId}`;
}

function toExperimentWithStats(exp: DemoExperimentSeed): Experiment {
  const variants: Variant[] = exp.variants.map((v) => ({
    id: v.id,
    experiment_id: exp.id,
    key: v.key,
    name: v.name,
    weight: v.weight,
    visitors: v.visitors,
    conversions: v.conversions,
    conversion_rate: v.visitors > 0 ? ratioToPercentage(v.conversions / v.visitors) : 0,
  }));

  const control = variants.find((v) => v.key === 'control');
  const treatment = variants.find((v) => v.key !== 'control');
  const stats = computeSignificance(control, treatment);

  return {
    id: exp.id,
    key: exp.key,
    name: exp.name,
    description: exp.description,
    status: exp.status,
    target_metric: exp.target_metric,
    created_at: exp.created_at,
    variants,
    z_score: stats.zScore,
    confidence_percentage: stats.confidencePercentage,
    is_significant: stats.isSignificant,
  };
}

function processWebhook(event: { id: string; type: string; customerId: string; amountCents: number }): {
  status: 'reconciled' | 'duplicate' | 'unhandled';
  ledgerEntry?: PaymentLedgerEntry;
} {
  if (processedWebhookIds.has(event.id)) {
    return { status: 'duplicate' };
  }

  const customer = customers.find((c) => c.id === event.customerId);
  if (!customer) {
    // Cannot safely attribute this event to anyone, same as the real API.
    return { status: 'unhandled' };
  }

  const nowIso = new Date().toISOString();
  const baseEntry = {
    id: freshId('ledger'),
    customer_id: customer.id,
    customer_email: customer.email,
    stripe_event_id: event.id,
    event_type: event.type,
    currency: 'EUR',
    invoice_id: `in_${freshId('inv')}`,
    created_at: nowIso,
  };

  let ledgerEntry: PaymentLedgerEntry;

  switch (event.type) {
    case 'payment_intent.succeeded':
      ledgerEntry = { ...baseEntry, amount_cents: event.amountCents, status: 'settled' };
      customer.status = 'active';
      customer.mrr_cents += event.amountCents;
      funnelEvents.push({ id: freshId('evt'), customer_id: customer.id, stage: 'converted_paid', created_at: nowIso });
      break;

    case 'invoice.payment_failed':
      ledgerEntry = { ...baseEntry, amount_cents: event.amountCents, status: 'failed' };
      break;

    case 'charge.refunded': {
      ledgerEntry = { ...baseEntry, amount_cents: -event.amountCents, status: 'refunded' };
      const newMrr = Math.max(0, customer.mrr_cents - event.amountCents);
      customer.mrr_cents = newMrr;
      customer.status = newMrr === 0 ? 'churned' : 'active';
      break;
    }

    default:
      return { status: 'unhandled' };
  }

  ledger.push(ledgerEntry);
  processedWebhookIds.add(event.id);
  return { status: 'reconciled', ledgerEntry };
}

export const demoApi = {
  async getMetrics(): Promise<GrowthMetrics> {
    const activeCustomers = customers.filter((c) => c.status === 'active');
    const totalMrrCents = activeCustomers.reduce((sum, c) => sum + c.mrr_cents, 0);
    const mrrEur = Math.round(totalMrrCents / 100);
    const arpuEur = activeCustomers.length > 0 ? roundTo1dp(mrrEur / activeCustomers.length) : 0;

    const visits = funnelEvents.filter((e) => e.stage === 'visited').length;
    const paids = funnelEvents.filter((e) => e.stage === 'converted_paid').length;

    return {
      mrr_eur: mrrEur,
      total_customers: customers.length,
      active_subscribers: activeCustomers.length,
      funnel_conversion_rate: visits > 0 ? ratioToPercentage(paids / visits) : 0,
      arpu_eur: arpuEur,
    };
  },

  async getFunnel(): Promise<FunnelStepMetric[]> {
    const countsByStage: Record<string, number> = {};
    for (const { stage } of FUNNEL_STAGES) {
      const uniqueCustomers = new Set(funnelEvents.filter((e) => e.stage === stage).map((e) => e.customer_id));
      countsByStage[stage] = uniqueCustomers.size;
    }
    return computeFunnelMetrics(countsByStage);
  },

  async getExperiments(): Promise<Experiment[]> {
    return experiments.map(toExperimentWithStats);
  },

  async evaluateExperiment(experimentKey: string, userId: string): Promise<{ variant: string; isNew: boolean }> {
    const experiment = experiments.find((e) => e.key === experimentKey);
    if (!experiment) {
      // Matches the message the real API sends for a 404 (see
      // server/src/services/experiment.service.ts evaluate()).
      throw new Error(`Experiment '${experimentKey}' not found`);
    }

    if (experiment.status !== 'running') {
      return { variant: 'control', isNew: false };
    }

    const key = allocationKey(experiment.id, userId);
    const existing = allocations.get(key);
    if (existing) {
      return { variant: existing.variant_key, isNew: false };
    }

    const selectedVariant = allocateVariant(experimentKey, userId, experiment.variants);
    allocations.set(key, {
      experiment_id: experiment.id,
      user_id: userId,
      variant_key: selectedVariant,
      converted: false,
      allocated_at: new Date().toISOString(),
      converted_at: null,
    });

    const variant = experiment.variants.find((v) => v.key === selectedVariant);
    if (variant) variant.visitors += 1;

    return { variant: selectedVariant, isNew: true };
  },

  async convertExperiment(experimentKey: string, userId: string): Promise<{ converted: boolean }> {
    const experiment = experiments.find((e) => e.key === experimentKey);
    if (!experiment) return { converted: false };

    const allocation = allocations.get(allocationKey(experiment.id, userId));
    if (!allocation || allocation.converted) {
      return { converted: false };
    }

    allocation.converted = true;
    allocation.converted_at = new Date().toISOString();
    const variant = experiment.variants.find((v) => v.key === allocation.variant_key);
    if (variant) variant.conversions += 1;

    return { converted: true };
  },

  async getLedger(): Promise<PaymentLedgerEntry[]> {
    return [...ledger].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 50);
  },

  async simulateWebhook(dto: {
    event_type: string;
    customer_id?: string;
    amount_cents?: number;
    idempotency_key?: string;
  }): Promise<any> {
    // Mirrors server/src/controllers/payment.controller.ts simulateWebhook's
    // validation, so a bad request behaves the same way in both modes.
    if (typeof dto.customer_id !== 'string' || dto.customer_id.trim().length === 0) {
      throw new Error('customer_id is required');
    }
    if (dto.event_type !== undefined && !SIMULATABLE_EVENT_TYPES.has(dto.event_type)) {
      throw new Error(`event_type must be one of: ${Array.from(SIMULATABLE_EVENT_TYPES).join(', ')}`);
    }
    if (
      dto.amount_cents !== undefined &&
      (typeof dto.amount_cents !== 'number' || !Number.isFinite(dto.amount_cents) || dto.amount_cents <= 0)
    ) {
      throw new Error('amount_cents must be a positive number');
    }

    const eventId = dto.idempotency_key || freshId('evt_sim');
    const result = processWebhook({
      id: eventId,
      type: (dto.event_type as StripeEventType) || 'payment_intent.succeeded',
      customerId: dto.customer_id,
      amountCents: typeof dto.amount_cents === 'number' ? dto.amount_cents : 9900,
    });

    return {
      success: true,
      eventId,
      reconciled: result.status === 'reconciled',
      duplicate: result.status === 'duplicate',
      ledger: result.ledgerEntry,
    };
  },

  async getCustomers(): Promise<Customer[]> {
    return [...customers].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  async getCustomerTimeline(id: string): Promise<{ events: unknown[]; allocations: unknown[]; ledger: unknown[] }> {
    const events = funnelEvents
      .filter((e) => e.customer_id === id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const allocs = Array.from(allocations.values())
      .filter((a) => a.user_id === id)
      .map((a) => {
        const experiment = experiments.find((e) => e.id === a.experiment_id);
        return {
          id: allocationKey(a.experiment_id, a.user_id),
          experiment_id: a.experiment_id,
          experiment_name: experiment?.name,
          experiment_key: experiment?.key,
          user_id: a.user_id,
          variant_key: a.variant_key,
          converted: a.converted,
          allocated_at: a.allocated_at,
          converted_at: a.converted_at,
        };
      });

    const ledgerEntries = ledger
      .filter((l) => l.customer_id === id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return { events, allocations: allocs, ledger: ledgerEntries };
  },
};


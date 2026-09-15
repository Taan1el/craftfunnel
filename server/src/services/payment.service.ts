import { PaymentRepository } from '../repositories/payment.repository.js';
import { CustomerRepository } from '../repositories/customer.repository.js';
import { FunnelRepository } from '../repositories/funnel.repository.js';
import { PaymentLedgerEntry } from '../../../shared/types.js';

export interface StripeEventPayload {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      customer?: string;
      amount?: number;
      currency?: string;
      customer_email?: string;
      invoice?: string;
    };
  };
}

export class PaymentService {
  constructor(
    private paymentRepo: PaymentRepository,
    private customerRepo: CustomerRepository,
    private funnelRepo: FunnelRepository
  ) {}

  processStripeWebhook(event: StripeEventPayload): {
    status: 'reconciled' | 'duplicate' | 'unhandled';
    ledgerEntry?: PaymentLedgerEntry;
  } {
    const eventId = event.id;
    const eventType = event.type;
    const obj = event.data?.object || {};

    // 1. Check Idempotency: Has this Stripe event already been processed?
    if (this.paymentRepo.isWebhookProcessed(eventId)) {
      return { status: 'duplicate' };
    }

    // Resolve customer by id, then by email. An event that names neither, or
    // names one that does not exist, cannot be safely attributed to anyone,
    // so it is left unhandled rather than charged to an arbitrary customer.
    let customer = obj.customer ? this.customerRepo.getCustomerById(obj.customer) : null;
    if (!customer && obj.customer_email) {
      const allCustomers = this.customerRepo.listCustomers();
      customer = allCustomers.find((c) => c.email === obj.customer_email) || null;
    }

    if (!customer) {
      return { status: 'unhandled' };
    }

    let ledgerEntry: PaymentLedgerEntry | undefined;

    switch (eventType) {
      case 'payment_intent.succeeded': {
        const amountCents = typeof obj.amount === 'number' && obj.amount >= 0 ? obj.amount : 9900;
        const currency = (obj.currency || 'EUR').toUpperCase();

        // 1. Record Ledger Entry
        ledgerEntry = this.paymentRepo.recordLedgerEntry({
          customer_id: customer.id,
          stripe_event_id: eventId,
          event_type: eventType,
          amount_cents: amountCents,
          currency,
          status: 'settled',
          invoice_id: obj.invoice || null,
        });

        // 2. Transition Customer to Active & Update MRR
        this.customerRepo.updateStatus(customer.id, 'active', customer.mrr_cents + amountCents);

        // 3. Track Funnel Conversion
        this.funnelRepo.trackEvent(customer.id, 'converted_paid', {
          stripe_event_id: eventId,
          amount: amountCents,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const amountCents = typeof obj.amount === 'number' && obj.amount >= 0 ? obj.amount : 9900;
        ledgerEntry = this.paymentRepo.recordLedgerEntry({
          customer_id: customer.id,
          stripe_event_id: eventId,
          event_type: eventType,
          amount_cents: amountCents,
          currency: (obj.currency || 'EUR').toUpperCase(),
          status: 'failed',
          invoice_id: obj.invoice || null,
        });
        break;
      }

      case 'charge.refunded': {
        const amountCents = typeof obj.amount === 'number' && obj.amount >= 0 ? obj.amount : 9900;
        ledgerEntry = this.paymentRepo.recordLedgerEntry({
          customer_id: customer.id,
          stripe_event_id: eventId,
          event_type: eventType,
          amount_cents: -amountCents,
          currency: (obj.currency || 'EUR').toUpperCase(),
          status: 'refunded',
          invoice_id: obj.invoice || null,
        });

        const newMrr = Math.max(0, customer.mrr_cents - amountCents);
        this.customerRepo.updateStatus(customer.id, newMrr === 0 ? 'churned' : 'active', newMrr);
        break;
      }

      default:
        return { status: 'unhandled' };
    }

    // Mark webhook event as processed
    this.paymentRepo.markWebhookProcessed(eventId, eventType, 'reconciled');

    return { status: 'reconciled', ledgerEntry };
  }

  listLedger(): PaymentLedgerEntry[] {
    return this.paymentRepo.listLedger(50);
  }

  getMetrics() {
    return this.paymentRepo.getGrowthMetrics();
  }
}

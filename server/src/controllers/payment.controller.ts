import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service.js';
import crypto from 'node:crypto';

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  handleWebhook = (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = req.body;
      if (!event || !event.id || !event.type) {
        res.status(400).json({ success: false, error: 'Invalid Stripe webhook payload: missing id or type' });
        return;
      }

      const result = this.paymentService.processStripeWebhook(event);

      if (result.status === 'duplicate') {
        res.status(200).json({
          success: true,
          reconciled: false,
          duplicate: true,
          message: `Stripe event ${event.id} was previously reconciled. Idempotent skip.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        reconciled: result.status === 'reconciled',
        ledger: result.ledgerEntry,
      });
    } catch (err) {
      next(err);
    }
  };

  simulateWebhook = (req: Request, res: Response, next: NextFunction) => {
    try {
      const { event_type, customer_id, amount_cents, idempotency_key } = req.body;

      const eventId = idempotency_key || `evt_sim_${crypto.randomBytes(6).toString('hex')}`;
      const mockEvent = {
        id: eventId,
        type: event_type || 'payment_intent.succeeded',
        data: {
          object: {
            id: `pi_${crypto.randomBytes(6).toString('hex')}`,
            customer: customer_id,
            amount: amount_cents || 9900,
            currency: 'EUR',
            invoice: `in_${crypto.randomBytes(4).toString('hex')}`,
          },
        },
      };

      const result = this.paymentService.processStripeWebhook(mockEvent);
      res.json({
        success: true,
        eventId,
        reconciled: result.status === 'reconciled',
        duplicate: result.status === 'duplicate',
        ledger: result.ledgerEntry,
      });
    } catch (err) {
      next(err);
    }
  };

  listLedger = (_req: Request, res: Response, next: NextFunction) => {
    try {
      const entries = this.paymentService.listLedger();
      res.json({ success: true, data: entries });
    } catch (err) {
      next(err);
    }
  };

  getGrowthMetrics = (_req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = this.paymentService.getMetrics();
      res.json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  };
}

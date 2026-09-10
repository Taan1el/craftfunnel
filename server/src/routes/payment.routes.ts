import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';

export function createPaymentRoutes(controller: PaymentController): Router {
  const router = Router();
  router.post('/payments/webhook', controller.handleWebhook);
  router.post('/payments/simulate', controller.simulateWebhook);
  router.get('/payments/ledger', controller.listLedger);
  router.get('/payments/metrics', controller.getGrowthMetrics);
  return router;
}

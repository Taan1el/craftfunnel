import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller.js';

export function createCustomerRoutes(controller: CustomerController): Router {
  const router = Router();
  router.get('/customers', controller.list);
  router.get('/customers/:id', controller.getById);
  router.get('/customers/:id/timeline', controller.getTimeline);
  return router;
}

import { Router } from 'express';
import { FunnelController } from '../controllers/funnel.controller.js';

export function createFunnelRoutes(controller: FunnelController): Router {
  const router = Router();
  router.get('/funnel/metrics', controller.getMetrics);
  router.post('/funnel/track', controller.track);
  return router;
}

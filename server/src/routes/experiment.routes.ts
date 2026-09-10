import { Router } from 'express';
import { ExperimentController } from '../controllers/experiment.controller.js';

export function createExperimentRoutes(controller: ExperimentController): Router {
  const router = Router();
  router.get('/experiments', controller.list);
  router.post('/experiments/evaluate', controller.evaluate);
  router.post('/experiments/convert', controller.convert);
  return router;
}

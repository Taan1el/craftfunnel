import { Request, Response, NextFunction } from 'express';
import { FunnelService } from '../services/funnel.service.js';
import { FunnelStage } from '../../../shared/types.js';

export class FunnelController {
  constructor(private funnelService: FunnelService) {}

  getMetrics = (_req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = this.funnelService.getFunnelMetrics();
      res.json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  };

  track = (req: Request, res: Response, next: NextFunction) => {
    try {
      const { customer_id, stage, metadata } = req.body;
      if (!customer_id || !stage) {
        res.status(400).json({ success: false, error: 'customer_id and stage are required' });
        return;
      }

      this.funnelService.track(customer_id, stage as FunnelStage, metadata);
      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  };
}

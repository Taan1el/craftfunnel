import { Request, Response, NextFunction } from 'express';
import { ExperimentService } from '../services/experiment.service.js';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export class ExperimentController {
  constructor(private expService: ExperimentService) {}

  list = (_req: Request, res: Response, next: NextFunction) => {
    try {
      const experiments = this.expService.listExperiments();
      res.json({ success: true, data: experiments });
    } catch (err) {
      next(err);
    }
  };

  evaluate = (req: Request, res: Response, next: NextFunction) => {
    try {
      const { experiment_key, user_id } = req.body;
      if (!isNonEmptyString(experiment_key) || !isNonEmptyString(user_id)) {
        res.status(400).json({ success: false, error: 'experiment_key and user_id are required' });
        return;
      }

      const result = this.expService.evaluate(experiment_key, user_id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  convert = (req: Request, res: Response, next: NextFunction) => {
    try {
      const { experiment_key, user_id } = req.body;
      if (!isNonEmptyString(experiment_key) || !isNonEmptyString(user_id)) {
        res.status(400).json({ success: false, error: 'experiment_key and user_id are required' });
        return;
      }

      const converted = this.expService.trackConversion(experiment_key, user_id);
      res.json({ success: true, data: { converted } });
    } catch (err) {
      next(err);
    }
  };
}

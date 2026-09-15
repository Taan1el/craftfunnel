import { FunnelRepository } from '../repositories/funnel.repository.js';
import { FunnelStage, FunnelStepMetric } from '../../../shared/types.js';
import { isValidFunnelStage } from '../../../shared/funnel-logic.js';
import { HttpError } from '../../../shared/http-error.js';

export class FunnelService {
  constructor(private funnelRepo: FunnelRepository) {}

  getFunnelMetrics(): FunnelStepMetric[] {
    return this.funnelRepo.getFunnelMetrics();
  }

  track(customerId: string, stage: FunnelStage, metadata?: Record<string, unknown>): void {
    if (!isValidFunnelStage(stage)) {
      throw new HttpError(400, `Unknown funnel stage '${stage}'`);
    }
    this.funnelRepo.trackEvent(customerId, stage, metadata);
  }
}

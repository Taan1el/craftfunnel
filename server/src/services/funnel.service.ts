import { FunnelRepository } from '../repositories/funnel.repository.js';
import { FunnelStage, FunnelStepMetric } from '../../../shared/types.js';

export class FunnelService {
  constructor(private funnelRepo: FunnelRepository) {}

  getFunnelMetrics(): FunnelStepMetric[] {
    return this.funnelRepo.getFunnelMetrics();
  }

  track(customerId: string, stage: FunnelStage, metadata?: Record<string, unknown>): void {
    this.funnelRepo.trackEvent(customerId, stage, metadata);
  }
}

import { ExperimentRepository } from '../repositories/experiment.repository.js';
import { Experiment } from '../../../shared/types.js';
import { allocateVariant, computeSignificance } from '../../../shared/experiment-logic.js';
import { HttpError } from '../../../shared/http-error.js';

export class ExperimentService {
  constructor(private expRepo: ExperimentRepository) {}

  listExperiments(): Experiment[] {
    const experiments = this.expRepo.listExperiments();

    return experiments.map((exp) => {
      const control = exp.variants.find((v) => v.key === 'control');
      const treatment = exp.variants.find((v) => v.key !== 'control');
      const stats = computeSignificance(control, treatment);

      return {
        ...exp,
        z_score: stats.zScore,
        confidence_percentage: stats.confidencePercentage,
        is_significant: stats.isSignificant,
      };
    });
  }

  evaluate(experimentKey: string, userId: string): { variant: string; isNew: boolean } {
    const experiment = this.expRepo.getExperimentByKey(experimentKey);
    if (!experiment) {
      throw new HttpError(404, `Experiment '${experimentKey}' not found`);
    }

    if (experiment.status !== 'running') {
      // Fall back to control
      return { variant: 'control', isNew: false };
    }

    // 1. Check existing allocation
    const existing = this.expRepo.getAllocation(experiment.id, userId);
    if (existing) {
      return { variant: existing.variant_key, isNew: false };
    }

    // 2. Deterministic hash-based allocation (shared with the demo build)
    const selectedVariant = allocateVariant(experimentKey, userId, experiment.variants);

    // 3. Persist allocation
    this.expRepo.recordAllocation(experiment.id, userId, selectedVariant);

    return { variant: selectedVariant, isNew: true };
  }

  trackConversion(experimentKey: string, userId: string): boolean {
    const experiment = this.expRepo.getExperimentByKey(experimentKey);
    if (!experiment) return false;

    return this.expRepo.recordConversion(experiment.id, userId);
  }
}

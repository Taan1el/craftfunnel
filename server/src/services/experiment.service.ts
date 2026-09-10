import crypto from 'node:crypto';
import { ExperimentRepository } from '../repositories/experiment.repository.js';
import { Experiment, Variant } from '../../../shared/types.js';

export class ExperimentService {
  constructor(private expRepo: ExperimentRepository) {}

  listExperiments(): Experiment[] {
    const experiments = this.expRepo.listExperiments();

    return experiments.map((exp) => {
      const stats = this.computeSignificance(exp.variants);
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
      throw new Error(`Experiment '${experimentKey}' not found`);
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

    // 2. Deterministic Hash-Based Allocation
    // hash = SHA256(userId + ":" + experimentKey)
    const hash = crypto.createHash('sha256').update(`${userId}:${experimentKey}`).digest();
    const bucket = hash.readUInt32BE(0) % 100; // 0..99

    let accumulatedWeight = 0;
    let selectedVariant = experiment.variants[0]?.key || 'control';

    for (const v of experiment.variants) {
      accumulatedWeight += v.weight;
      if (bucket < accumulatedWeight) {
        selectedVariant = v.key;
        break;
      }
    }

    // 3. Persist allocation
    this.expRepo.recordAllocation(experiment.id, userId, selectedVariant);

    return { variant: selectedVariant, isNew: true };
  }

  trackConversion(experimentKey: string, userId: string): boolean {
    const experiment = this.expRepo.getExperimentByKey(experimentKey);
    if (!experiment) return false;

    return this.expRepo.recordConversion(experiment.id, userId);
  }

  /**
   * Calculates 2-proportion Z-score and statistical confidence between Control and Variant A
   */
  private computeSignificance(variants: Variant[]): {
    zScore: number | null;
    confidencePercentage: number | null;
    isSignificant: boolean;
  } {
    const control = variants.find((v) => v.key === 'control');
    const treatment = variants.find((v) => v.key !== 'control');

    if (!control || !treatment || control.visitors < 10 || treatment.visitors < 10) {
      return { zScore: null, confidencePercentage: null, isSignificant: false };
    }

    const n1 = control.visitors;
    const x1 = control.conversions;
    const p1 = x1 / n1;

    const n2 = treatment.visitors;
    const x2 = treatment.conversions;
    const p2 = x2 / n2;

    const pPooled = (x1 + x2) / (n1 + n2);
    if (pPooled === 0 || pPooled === 1) {
      return { zScore: 0, confidencePercentage: 50, isSignificant: false };
    }

    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
    if (se === 0) {
      return { zScore: 0, confidencePercentage: 50, isSignificant: false };
    }

    const z = (p2 - p1) / se;
    const roundedZ = Math.round(z * 100) / 100;

    // Normal Cumulative Distribution approximation (Error Function)
    const confidence = Math.round((0.5 * (1 + this.erf(Math.abs(z) / Math.SQRT2))) * 1000) / 10;
    const isSignificant = Math.abs(roundedZ) >= 1.96; // 95% threshold

    return {
      zScore: roundedZ,
      confidencePercentage: confidence,
      isSignificant,
    };
  }

  private erf(x: number): number {
    // A&S formula 7.1.26 approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}

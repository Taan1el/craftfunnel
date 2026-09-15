// Pure experiment allocation and significance math, with no database or
// framework dependency, so the server and the in-browser demo can both use
// it and are guaranteed to behave identically.
import { sha256Bytes } from './sha256.js';

/** Minimum visitors required per variant before significance is reported. */
export const MIN_SAMPLE_SIZE = 10;

/** Z-score magnitude corresponding to a two-tailed 95% confidence level. */
export const SIGNIFICANCE_Z_THRESHOLD = 1.96;

export interface AllocationVariant {
  key: string;
  weight: number;
}

/**
 * Deterministically assigns a user to one of an experiment's variants.
 *
 * bucket = SHA256(userId + ":" + experimentKey) mod 100, then walked against
 * cumulative variant weights. The same user id and experiment key always
 * produce the same bucket, so the same variant, without a database lookup.
 */
export function allocateVariant(experimentKey: string, userId: string, variants: AllocationVariant[]): string {
  const digest = sha256Bytes(`${userId}:${experimentKey}`);
  const bucket = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  const bucketMod100 = bucket % 100;

  let accumulatedWeight = 0;
  let selectedVariant = variants[0]?.key ?? 'control';

  for (const v of variants) {
    accumulatedWeight += v.weight;
    if (bucketMod100 < accumulatedWeight) {
      selectedVariant = v.key;
      break;
    }
  }

  return selectedVariant;
}

export interface VariantOutcome {
  visitors: number;
  conversions: number;
}

export interface SignificanceResult {
  zScore: number | null;
  confidencePercentage: number | null;
  isSignificant: boolean;
}

const NO_SIGNAL: SignificanceResult = { zScore: 0, confidencePercentage: 0, isSignificant: false };
const NOT_ENOUGH_DATA: SignificanceResult = { zScore: null, confidencePercentage: null, isSignificant: false };

/**
 * Two-proportion Z-test between a control and a treatment variant.
 *
 * `confidencePercentage` is the two-tailed confidence that the variants
 * differ (2 * Phi(|z|) - 1), so it crosses 95% at the same |z| >= 1.96
 * boundary used for `isSignificant` — the two numbers agree at the
 * threshold instead of one saying "significant" while the other still
 * reads under 95%.
 */
export function computeSignificance(
  control: VariantOutcome | undefined,
  treatment: VariantOutcome | undefined
): SignificanceResult {
  if (!control || !treatment || control.visitors < MIN_SAMPLE_SIZE || treatment.visitors < MIN_SAMPLE_SIZE) {
    return NOT_ENOUGH_DATA;
  }

  const n1 = control.visitors;
  const x1 = control.conversions;
  const p1 = x1 / n1;

  const n2 = treatment.visitors;
  const x2 = treatment.conversions;
  const p2 = x2 / n2;

  const pPooled = (x1 + x2) / (n1 + n2);
  if (pPooled === 0 || pPooled === 1) {
    // Every visitor converted, or none did, in both groups: no variance, so
    // there is no statistical signal either way (not "50% confidence").
    return NO_SIGNAL;
  }

  const standardError = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
  if (standardError === 0) {
    return NO_SIGNAL;
  }

  const z = (p2 - p1) / standardError;
  const roundedZ = Math.round(z * 100) / 100;
  const confidence = Math.max(0, Math.round((2 * normalCdf(Math.abs(z)) - 1) * 1000) / 10);
  const isSignificant = Math.abs(roundedZ) >= SIGNIFICANCE_Z_THRESHOLD;

  return {
    zScore: roundedZ,
    confidencePercentage: confidence,
    isSignificant,
  };
}

/** Standard normal cumulative distribution function. */
function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Abramowitz & Stegun 7.1.26 approximation of the error function. */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

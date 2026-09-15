import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { allocateVariant, computeSignificance, MIN_SAMPLE_SIZE } from '../../shared/experiment-logic.js';

describe('allocateVariant', () => {
  it('is deterministic for the same user and experiment', () => {
    const variants = [
      { key: 'control', weight: 50 },
      { key: 'variant_a', weight: 50 },
    ];
    const first = allocateVariant('checkout_cta_copy', 'usr_123', variants);
    const second = allocateVariant('checkout_cta_copy', 'usr_123', variants);
    expect(first).toBe(second);
  });

  it('matches SHA256(userId + ":" + experimentKey) mod 100 walked against cumulative weights', () => {
    const variants = [
      { key: 'control', weight: 30 },
      { key: 'variant_a', weight: 70 },
    ];
    const userId = 'usr_cross_check';
    const experimentKey = 'exp_cross_check';

    const digest = crypto.createHash('sha256').update(`${userId}:${experimentKey}`).digest();
    const bucket = digest.readUInt32BE(0) % 100;
    const expected = bucket < 30 ? 'control' : 'variant_a';

    expect(allocateVariant(experimentKey, userId, variants)).toBe(expected);
  });

  it('always assigns the only fully-weighted variant', () => {
    const allControl = [
      { key: 'control', weight: 100 },
      { key: 'variant_a', weight: 0 },
    ];
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      expect(allocateVariant('exp', id, allControl)).toBe('control');
    }
  });

  it('falls back to the first variant key when given no variants', () => {
    expect(allocateVariant('exp', 'usr_1', [])).toBe('control');
  });

  it('distributes roughly according to configured weights across many users', () => {
    const variants = [
      { key: 'control', weight: 20 },
      { key: 'variant_a', weight: 80 },
    ];
    let controlCount = 0;
    const total = 2000;
    for (let i = 0; i < total; i++) {
      const variant = allocateVariant('weight_check', `user_${i}`, variants);
      if (variant === 'control') controlCount++;
    }
    const controlShare = controlCount / total;
    // Hash-based allocation is not exactly 20% for any finite sample, but it
    // should land close for a sample this large.
    expect(controlShare).toBeGreaterThan(0.15);
    expect(controlShare).toBeLessThan(0.25);
  });
});

describe('computeSignificance', () => {
  it('returns nulls when either variant is below the minimum sample size', () => {
    const result = computeSignificance(
      { visitors: MIN_SAMPLE_SIZE - 1, conversions: 1 },
      { visitors: 50, conversions: 10 }
    );
    expect(result.zScore).toBeNull();
    expect(result.confidencePercentage).toBeNull();
    expect(result.isSignificant).toBe(false);
  });

  it('returns no signal (not 50%) when nobody converted in either group', () => {
    const result = computeSignificance({ visitors: 100, conversions: 0 }, { visitors: 100, conversions: 0 });
    expect(result.zScore).toBe(0);
    expect(result.confidencePercentage).toBe(0);
    expect(result.isSignificant).toBe(false);
  });

  it('returns no signal when everybody converted in both groups', () => {
    const result = computeSignificance({ visitors: 50, conversions: 50 }, { visitors: 50, conversions: 50 });
    expect(result.confidencePercentage).toBe(0);
    expect(result.isSignificant).toBe(false);
  });

  it('flags a large, consistent lift as significant with confidence at or above 95%', () => {
    const result = computeSignificance({ visitors: 200, conversions: 20 }, { visitors: 200, conversions: 60 });
    expect(result.isSignificant).toBe(true);
    expect(result.confidencePercentage).not.toBeNull();
    expect(result.confidencePercentage as number).toBeGreaterThanOrEqual(95);
  });

  it('keeps confidence and isSignificant consistent: significant only once confidence reaches 95%', () => {
    const cases: [number, number, number, number][] = [
      [100, 10, 100, 12],
      [100, 10, 100, 18],
      [100, 10, 100, 25],
      [50, 5, 50, 40],
      [300, 30, 300, 33],
    ];
    for (const [n1, x1, n2, x2] of cases) {
      const result = computeSignificance({ visitors: n1, conversions: x1 }, { visitors: n2, conversions: x2 });
      if (result.isSignificant) {
        expect(result.confidencePercentage as number).toBeGreaterThanOrEqual(95);
      } else {
        expect(result.confidencePercentage as number).toBeLessThan(95);
      }
    }
  });

  it('is symmetric: swapping control and treatment flips the sign of the Z-score but not the confidence', () => {
    const a = computeSignificance({ visitors: 150, conversions: 30 }, { visitors: 150, conversions: 50 });
    const b = computeSignificance({ visitors: 150, conversions: 50 }, { visitors: 150, conversions: 30 });
    expect(a.zScore).toBe(-(b.zScore as number));
    expect(a.confidencePercentage).toBe(b.confidencePercentage);
    expect(a.isSignificant).toBe(b.isSignificant);
  });
});

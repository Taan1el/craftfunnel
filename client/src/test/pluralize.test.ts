import { describe, it, expect } from 'vitest';
import { pluralize, formatCount } from '../utils/pluralize.js';

describe('pluralize', () => {
  it('uses the singular form for exactly 1', () => {
    expect(pluralize(1, 'customer')).toBe('customer');
    expect(pluralize(-1, 'customer')).toBe('customer');
  });

  it('uses the regular plural form (adds "s") for any other count', () => {
    expect(pluralize(0, 'customer')).toBe('customers');
    expect(pluralize(2, 'customer')).toBe('customers');
    expect(pluralize(30, 'visitor')).toBe('visitors');
  });

  it('uses an explicit irregular plural when given one', () => {
    expect(pluralize(1, 'variant', 'variants')).toBe('variant');
    expect(pluralize(2, 'variant', 'variants')).toBe('variants');
    expect(pluralize(0, 'variant', 'variants')).toBe('variants');
  });
});

describe('formatCount', () => {
  it('joins the count and the correctly pluralized noun', () => {
    expect(formatCount(1, 'customer')).toBe('1 customer');
    expect(formatCount(2, 'customer')).toBe('2 customers');
    expect(formatCount(0, 'experiment')).toBe('0 experiments');
    expect(formatCount(1, 'entry', 'entries')).toBe('1 entry');
    expect(formatCount(5, 'entry', 'entries')).toBe('5 entries');
  });
});

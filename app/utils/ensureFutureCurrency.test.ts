import { describe, expect, it } from 'vitest';
import { ensureFutureCurrency } from './ensureFutureCurrency';

describe('ensureFutureCurrency', () => {
  it('strips leading zeros from whole numbers', () => {
    // Users often type values like "00150"; the stored value should be the canonical "150".
    expect(ensureFutureCurrency('00150')).toBe('150');
  });

  it('limits fractional input to two decimal places', () => {
    // Currency only supports two decimal places; extra digits should be truncated, not rounded.
    expect(ensureFutureCurrency('100.999')).toBe('100.99');
  });

  it('preserves a leading minus sign', () => {
    // Negative values can occur during editing (e.g. a discount). The sign must survive formatting.
    expect(ensureFutureCurrency('-50')).toBe('-50');
  });

  it('returns undefined for empty or non-numeric input', () => {
    // When the user has typed nothing meaningful, the field should be empty rather than "NaN" or "0".
    expect(ensureFutureCurrency('')).toBeUndefined();
    expect(ensureFutureCurrency('abc')).toBeUndefined();
  });
});

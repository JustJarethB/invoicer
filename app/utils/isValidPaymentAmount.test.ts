import { describe, expect, it } from 'vitest';
import { isValidPaymentAmount } from './isValidPaymentAmount';

describe('isValidPaymentAmount', () => {
  it('accepts positive finite numbers', () => {
    // Payments must represent real money entering the system.
    expect(isValidPaymentAmount(1)).toBe(true);
    expect(isValidPaymentAmount(100.5)).toBe(true);
  });

  it('rejects zero', () => {
    // A zero payment is not a meaningful transaction and would clutter the ledger.
    expect(isValidPaymentAmount(0)).toBe(false);
  });

  it('rejects negative amounts', () => {
    // Refunds are not supported by the payment flow; negative values are user error.
    expect(isValidPaymentAmount(-10)).toBe(false);
  });

  it('rejects NaN and Infinity', () => {
    // These are not valid monetary values and would corrupt balance calculations.
    expect(isValidPaymentAmount(NaN)).toBe(false);
    expect(isValidPaymentAmount(Infinity)).toBe(false);
    expect(isValidPaymentAmount(-Infinity)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { linePrice } from './linePrice';

describe('linePrice', () => {
  it('calculates a service line total from quantity and unit price', () => {
    // Service is the default charge type for billable work: qty × unitPrice.
    expect(linePrice({ qty: '2', unitPrice: '150', type: '0' })).toBe(300);
  });

  it('calculates a rental line total the same way as service', () => {
    // Rental and service share the same arithmetic but are reported separately on the invoice.
    expect(linePrice({ qty: '3', unitPrice: '100', type: '1' })).toBe(300);
  });

  it('calculates an expense line total from quantity and unit price', () => {
    // Expenses are reimbursable costs, not margin: still qty × unitPrice.
    expect(linePrice({ qty: '1', unitPrice: '45.5', type: '2' })).toBe(45.5);
  });

  it('returns a negative value for a discount', () => {
    // Discounts reduce the invoice total. The quantity is ignored so the line
    // always subtracts the given unitPrice amount once.
    expect(linePrice({ qty: '10', unitPrice: '25', type: '3' })).toBe(-25);
  });

  it('returns 0 when the charge type is missing', () => {
    // A blank line item should not contribute to the total until the user chooses a type.
    expect(linePrice({ qty: '2', unitPrice: '100', type: undefined })).toBe(0);
  });

  it('coerces string inputs to numbers', () => {
    // Inputs are stored as strings in the form, so the calculation must handle that.
    expect(linePrice({ qty: '2.5', unitPrice: '10', type: '0' })).toBe(25);
  });

  it('returns 0 when quantity or unit price are empty', () => {
    // Empty fields should not produce NaN; they should simply not add to the total.
    expect(linePrice({ qty: '', unitPrice: '100', type: '0' })).toBe(0);
    expect(linePrice({ qty: '2', unitPrice: '', type: '0' })).toBe(0);
  });
});

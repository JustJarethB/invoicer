import { describe, expect, it } from "vitest";
import { formatCurrency } from "./formatCurrency";

describe("formatCurrency", () => {
  it("formats a positive number to two decimal places", () => {
    // Invoices display monetary values with exactly two decimal places for accounting clarity.
    expect(formatCurrency(100)).toBe("100.00");
    expect(formatCurrency(99.999)).toBe("100.00");
  });

  it("falls back to 0.00 for NaN input", () => {
    // Empty or invalid inputs should never render as "NaN" on an invoice.
    expect(formatCurrency(NaN)).toBe("0.00");
    expect(formatCurrency(Number("not-a-number"))).toBe("0.00");
  });

  it("handles negative values", () => {
    // Discounts and overpayments can produce negative display values.
    expect(formatCurrency(-50)).toBe("-50.00");
  });
});

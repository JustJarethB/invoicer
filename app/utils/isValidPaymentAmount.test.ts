import { describe, expect, it } from "vitest";
import { isValidPaymentAmount } from "./isValidPaymentAmount";

describe("isValidPaymentAmount", () => {
  it("accepts positive finite numbers", () => {
    // Payments must represent real money entering the system.
    expect(isValidPaymentAmount(1)).toBe(true);
    expect(isValidPaymentAmount(100.5)).toBe(true);
  });

  it("rejects zero", () => {
    // A zero payment is not a meaningful transaction and would clutter the ledger.
    expect(isValidPaymentAmount(0)).toBe(false);
  });

  it("accepts negative amounts as corrections", () => {
    // A user who over-recorded a payment fixes it by entering a negative amount,
    // bringing totalPaid back in line with what was actually received.
    expect(isValidPaymentAmount(-10)).toBe(true);
  });

  it("rejects NaN and Infinity", () => {
    // These are not valid monetary values and would corrupt balance calculations.
    expect(isValidPaymentAmount(NaN)).toBe(false);
    expect(isValidPaymentAmount(Infinity)).toBe(false);
    expect(isValidPaymentAmount(-Infinity)).toBe(false);
  });
});

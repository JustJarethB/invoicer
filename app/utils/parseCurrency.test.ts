import { describe, expect, it } from "vitest";
import { parseCurrency } from "./parseCurrency";

describe("parseCurrency", () => {
  it("parses whole numbers", () => {
    expect(parseCurrency("150")).toBe(150);
  });

  it("strips leading zeros from whole numbers", () => {
    expect(parseCurrency("00150")).toBe(150);
  });

  it("limits fractional input to two decimal places", () => {
    // Currency only supports two decimal places; extra digits are truncated, not rounded.
    expect(parseCurrency("100.999")).toBe(100.99);
  });

  it("accepts a trailing decimal point while the user is mid-number", () => {
    // Typing "12." must emit 12, otherwise NumberInput rewrites the field to
    // "12" on every keystroke and the decimal digits can never be entered.
    expect(parseCurrency("12.")).toBe(12);
  });

  it("parses a leading-decimal input as a fraction of one", () => {
    // Typing ".5" should mean £0.50, not 5 or undefined.
    expect(parseCurrency(".5")).toBe(0.5);
  });

  it("preserves a leading minus sign", () => {
    // Discounts can be negative; the sign must survive parsing.
    expect(parseCurrency("-50")).toBe(-50);
  });

  it("returns undefined for empty or non-numeric input", () => {
    // An empty field should stay empty rather than store 0 or NaN.
    expect(parseCurrency("")).toBeUndefined();
    expect(parseCurrency("   ")).toBeUndefined();
    expect(parseCurrency("abc")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { invoiceTotal, linePrice, paymentStatusOf, type Invoice, type LineItem, type Payment } from "./invoice";

const line = (overrides: Partial<LineItem>): LineItem => ({ uuid: "l1", ...overrides });

describe("linePrice", () => {
  it("calculates a service line total from quantity and unit price", () => {
    // Service is the default charge type for billable work: qty × unitPrice.
    expect(linePrice({ qty: 2, unitPrice: 150, type: "0" })).toBe(300);
  });

  it("calculates a rental line total the same way as service", () => {
    expect(linePrice({ qty: 3, unitPrice: 100, type: "1" })).toBe(300);
  });

  it("calculates an expense line total from quantity and unit price", () => {
    expect(linePrice({ qty: 1, unitPrice: 45.5, type: "2" })).toBe(45.5);
  });

  it("returns a negative value for a discount", () => {
    // Discounts reduce the invoice total; quantity is ignored.
    expect(linePrice({ qty: 10, unitPrice: 25, type: "3" })).toBe(-25);
  });

  it("returns 0 when the charge type is missing", () => {
    // A blank line item should not contribute to the total until a type is chosen.
    expect(linePrice({ qty: 2, unitPrice: 100, type: undefined })).toBe(0);
  });

  it("returns 0 when quantity or unit price are absent", () => {
    // Missing fields should not produce NaN; they simply do not add to the total.
    expect(linePrice({ qty: undefined, unitPrice: 100, type: "0" })).toBe(0);
    expect(linePrice({ qty: 2, unitPrice: undefined, type: "0" })).toBe(0);
  });
});

describe("invoiceTotal", () => {
  it("sums line prices of an invoice", () => {
    const invoice = {
      lineItems: [line({ qty: 2, unitPrice: 150, type: "0" }), line({ uuid: "l2", qty: 1, unitPrice: 25, type: "3" })],
    };
    expect(invoiceTotal(invoice)).toBe(275);
  });
});

describe("paymentStatusOf", () => {
  const makeInvoice = (lineItems: LineItem[], payments: Payment[]): Pick<Invoice, "lineItems" | "payments"> => ({
    lineItems,
    payments,
  });

  const due300 = makeInvoice([line({ qty: 2, unitPrice: 150, type: "0" })], []);

  it("reports unpaid when no payments exist", () => {
    const summary = paymentStatusOf(due300);
    expect(summary.totalDue).toBe(300);
    expect(summary.totalPaid).toBe(0);
    expect(summary.due).toBe(300);
    expect(summary.paymentStatus).toBe("unpaid");
  });

  it("tolerates a missing payments array on older records", () => {
    const summary = paymentStatusOf({ lineItems: due300.lineItems } as Pick<Invoice, "lineItems" | "payments">);
    expect(summary.paymentStatus).toBe("unpaid");
  });

  it("reports partial when some but not all is paid", () => {
    const summary = paymentStatusOf(
      makeInvoice([line({ qty: 2, unitPrice: 150, type: "0" })], [{ amount: 100, date: "2026-01-01" }])
    );
    expect(summary.paymentStatus).toBe("partial");
    expect(summary.due).toBe(200);
  });

  it("reports paid when total paid equals total due", () => {
    const summary = paymentStatusOf(
      makeInvoice([line({ qty: 2, unitPrice: 150, type: "0" })], [
        { amount: 100, date: "2026-01-01" },
        { amount: 200, date: "2026-01-02" },
      ])
    );
    expect(summary.paymentStatus).toBe("paid");
    expect(summary.due).toBe(0);
  });

  it("reports overpaid when payments exceed the total", () => {
    const summary = paymentStatusOf(
      makeInvoice([line({ qty: 2, unitPrice: 150, type: "0" })], [{ amount: 400, date: "2026-01-01" }])
    );
    expect(summary.paymentStatus).toBe("overpaid");
    expect(summary.due).toBe(-100);
  });
});

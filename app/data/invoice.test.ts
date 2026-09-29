import { describe, expect, it } from "vitest";
import { type Invoice, InvoiceSchema, invoiceTotal, linePrice, paymentStatusOf } from "./invoice";
import { makeInvoice, makeLineItem, makePayment, ownerEmptyInvoiceFixture } from "./testFixtures";

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
      lineItems: [makeLineItem({ qty: 2, unitPrice: 150, type: "0" }), makeLineItem({ uuid: "l2", qty: 1, unitPrice: 25, type: "3" })],
    };
    expect(invoiceTotal(invoice)).toBe(275);
  });
});

describe("paymentStatusOf", () => {
  const due300 = makeInvoice({ lineItems: [makeLineItem({ qty: 2, unitPrice: 150, type: "0" })], payments: [] });

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
    const summary = paymentStatusOf(makeInvoice({ lineItems: [makeLineItem({ qty: 2, unitPrice: 150, type: "0" })], payments: [makePayment()] }));
    expect(summary.paymentStatus).toBe("partial");
    expect(summary.due).toBe(200);
  });

  it("reports paid when total paid equals total due", () => {
    const summary = paymentStatusOf(
      makeInvoice({
        lineItems: [makeLineItem({ qty: 2, unitPrice: 150, type: "0" })],
        payments: [makePayment(), makePayment({ amount: 200, date: "2026-01-02" })],
      })
    );
    expect(summary.paymentStatus).toBe("paid");
    expect(summary.due).toBe(0);
  });

  it("reports overpaid when payments exceed the total", () => {
    const summary = paymentStatusOf(
      makeInvoice({ lineItems: [makeLineItem({ qty: 2, unitPrice: 150, type: "0" })], payments: [makePayment({ amount: 400 })] })
    );
    expect(summary.paymentStatus).toBe("overpaid");
    expect(summary.due).toBe(-100);
  });
});

describe("InvoiceSchema (legacy money strings)", () => {
  // TODO(legacy-money-strings) resolution: older persisted invoices store
  // money as strings. The schema coerces complete finite numeric strings to
  // numbers (Number()-finite semantics: accepts "1e3", rejects
  // "Infinity"/"NaN"/malformed), maps blank optional strings to absence
  // (never zero), and keeps everything else invalid.
  const legacyInvoice = {
    id: "inv-legacy",
    date: "2026-01-01",
    purchaseOrder: "PO-1",
    logo: { url: "" },
    from: { name: "From Co" },
    to: { name: "Buyer", streetAddress: "", city: "", county: "", postCode: "" },
    lineItems: [{ uuid: "l1", type: "0", qty: "2", unitPrice: "150.00" }],
    payments: [{ amount: "100", date: "2026-01-02" }],
  };

  it("parses a legacy record, coercing string money to numbers", () => {
    const result = InvoiceSchema.safeParse(legacyInvoice);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lineItems[0].qty).toBe(2);
    expect(result.data.lineItems[0].unitPrice).toBe(150);
    expect(result.data.payments[0].amount).toBe(100);
  });

  it("yields correct totals for a legacy record (string amounts never concatenate)", () => {
    const result = InvoiceSchema.safeParse(legacyInvoice);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const summary = paymentStatusOf(result.data);
    expect(summary.totalDue).toBe(300);
    expect(summary.totalPaid).toBe(100);
    expect(summary.due).toBe(200);
    expect(summary.paymentStatus).toBe("partial");
    expect(invoiceTotal(result.data)).toBe(300);
  });

  it("maps blank optional money strings to absence, not zero", () => {
    const result = InvoiceSchema.safeParse({
      ...legacyInvoice,
      lineItems: [{ uuid: "l1", type: "0", qty: "", unitPrice: "   " }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lineItems[0].qty).toBeUndefined();
    expect(result.data.lineItems[0].unitPrice).toBeUndefined();
    expect(linePrice(result.data.lineItems[0])).toBe(0);
  });

  it("tolerates a legacy record without a payments array (or an explicit null)", () => {
    const { payments: _omitted, ...withoutPayments } = legacyInvoice;
    const absent = InvoiceSchema.safeParse(withoutPayments);
    expect(absent.success).toBe(true);
    if (absent.success) expect(absent.data.payments).toEqual([]);
    const nulled = InvoiceSchema.safeParse({ ...legacyInvoice, payments: null });
    expect(nulled.success).toBe(true);
    if (nulled.success) expect(nulled.data.payments).toEqual([]);
  });

  it("keeps the legacy -1 charge type valid", () => {
    const result = InvoiceSchema.safeParse({ ...legacyInvoice, lineItems: [{ uuid: "l1", type: "-1" }] });
    expect(result.success).toBe(true);
  });

  it("rejects malformed or non-finite money instead of crashing or zeroing", () => {
    expect(InvoiceSchema.safeParse({ ...legacyInvoice, lineItems: [{ uuid: "l1", unitPrice: "1,50" }] }).success).toBe(false);
    expect(InvoiceSchema.safeParse({ ...legacyInvoice, payments: [{ amount: "Infinity", date: "2026-01-02" }] }).success).toBe(false);
    expect(InvoiceSchema.safeParse({ ...legacyInvoice, payments: [{ amount: NaN }] }).success).toBe(false);
  });
});

describe("InvoiceSchema (legacy logo blobs)", () => {
  // Legacy logo normalization ported from PR #50's proven pattern (commit
  // 9a1c2c0 "fix: restore legacy invoice loading"): the owner's stored empty
  // invoice (id 1785798307) keeps `logo: { url: {} }`. Without unpicking it,
  // getAllValidated silently drops the record — the PR #48 incident class.
  it('parses the owner\'s stored empty-invoice fixture, coercing the object logo url to ""', () => {
    const result = InvoiceSchema.safeParse(ownerEmptyInvoiceFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.logo).toEqual({ url: "" });
    expect(invoiceTotal(result.data)).toBe(0);
    // Absent legacy `payments` normalize to [] and sum to 0: no thrown save/load,
    // no string concatenation.
    expect(paymentStatusOf(result.data).totalPaid).toBe(0);
    // paymentStatusOf labels an all-zero invoice "paid" (0 === 0): pre-existing
    // behavior on main, outside #43's scope, so not pinned here.
  });

  it("unwraps a double-wrapped legacy logo url to its inner string", () => {
    const result = InvoiceSchema.safeParse({ ...ownerEmptyInvoiceFixture, logo: { url: { url: "https://x/logo.png" } } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.logo).toEqual({ url: "https://x/logo.png" });
  });

  it("keeps a non-string, non-object logo url invalid", () => {
    expect(InvoiceSchema.safeParse({ ...ownerEmptyInvoiceFixture, logo: { url: 42 } }).success).toBe(false);
    expect(InvoiceSchema.safeParse({ ...ownerEmptyInvoiceFixture, logo: { url: null } }).success).toBe(false);
  });

  it("defaults a logo record with a missing url key to an empty string", () => {
    // Regression guard: the record-level default must survive the legacy
    // unwrap (`logo: {}` parsed to `{ url: "" }` before this tolerance).
    const result = InvoiceSchema.safeParse({ ...ownerEmptyInvoiceFixture, logo: {} });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.logo).toEqual({ url: "" });
  });
});

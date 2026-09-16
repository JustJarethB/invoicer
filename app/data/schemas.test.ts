import { describe, expect, it } from "vitest";
import {
  addressSchema,
  clientFormSchema,
  type Invoice,
  invoiceSchema,
  type LineItem,
  parseChargeTypeId,
  parseClientNameForm,
  paymentDetailsSchema,
} from "./schemas";

const validAddress = { city: "Town", county: "Shire", name: "Acme", postCode: "PC1 1AA", streetAddress: "1 St" };

const validInvoice = (): Invoice => ({
  date: "2026-01-01",
  from: validAddress,
  id: "inv-1",
  lineItems: [{ qty: 2, type: "0", unitPrice: 150, uuid: "l1" }],
  logo: { url: "https://example.com/logo.png" },
  payments: [],
  purchaseOrder: "PO-1",
  to: validAddress,
});

describe("addressSchema", () => {
  it("accepts a complete address", () => {
    expect(addressSchema.safeParse(validAddress).success).toBe(true);
  });

  it("defaults a field absent from an older record to an empty string", () => {
    // The legacy addressFromRecord defaulted missing fields to ""; the schema
    // keeps that contract while still type-checking every present field.
    const { county: _county, ...incomplete } = validAddress;
    const result = addressSchema.safeParse(incomplete);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.county).toBe("");
  });

  it("rejects an address with a non-string field", () => {
    expect(addressSchema.safeParse({ ...validAddress, postCode: 42 }).success).toBe(false);
  });
});

describe("invoiceSchema", () => {
  it("accepts a full invoice", () => {
    expect(invoiceSchema.safeParse(validInvoice()).success).toBe(true);
  });

  it("accepts an older record without payments (type/impl mismatch fix)", () => {
    // Older persisted records legitimately lack `payments`; the schema makes
    // it optional so validate-on-read does not discard them.
    const { payments: _payments, ...withoutPayments } = validInvoice();
    const result = invoiceSchema.safeParse(withoutPayments);
    expect(result.success).toBe(true);
  });

  it("rejects an invoice whose line item has an out-of-union charge type", () => {
    const bad = validInvoice();
    bad.lineItems = [{ type: "9", uuid: "l1" }] as unknown as LineItem[];
    expect(invoiceSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invoice with a non-numeric qty", () => {
    const bad = validInvoice();
    (bad.lineItems[0] as LineItem).qty = "3" as unknown as number;
    expect(invoiceSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invoice missing the logo", () => {
    const bad = validInvoice();
    delete (bad as Partial<Invoice>).logo;
    expect(invoiceSchema.safeParse(bad).success).toBe(false);
  });
});

describe("paymentDetailsSchema", () => {
  it("defaults fields absent from a stored blob to empty strings", () => {
    // The payment-details Autosave form does not render every field; older
    // stored blobs legitimately lack them.
    const result = paymentDetailsSchema.parse({ terms: "Net 30" });
    expect(result).toEqual({
      bankName: "",
      emailAddress: "",
      info: "",
      number: "",
      phoneNumber: "",
      sortCode: "",
      terms: "Net 30",
      type: "",
    });
  });
});

describe("clientFormSchema", () => {
  it("accepts the contact fields the clients form collects", () => {
    expect(clientFormSchema.safeParse({ contactName: "Acme", email: "a@b.test", phone: "123" }).success).toBe(true);
  });

  it("rejects a form payload missing the email field", () => {
    // The old cast turned a missing field into `email: undefined` typed as
    // string and persisted it; validation now surfaces it.
    expect(clientFormSchema.safeParse({ contactName: "Acme", phone: "123" }).success).toBe(false);
  });
});

describe("parseChargeTypeId", () => {
  it("accepts every id in the charge-type table", () => {
    for (const id of ["0", "1", "2", "3"]) {
      expect(parseChargeTypeId(id).success).toBe(true);
    }
  });

  it("rejects values outside the charge-type union", () => {
    expect(parseChargeTypeId("9").success).toBe(false);
    expect(parseChargeTypeId("-1").success).toBe(false);
    expect(parseChargeTypeId("").success).toBe(false);
  });
});

describe("parseClientNameForm", () => {
  it("accepts a record with contactName and strips unknown fields", () => {
    const result = parseClientNameForm({ contactName: "Acme", rogue: "ignored" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ contactName: "Acme" });
  });

  it("rejects a record without contactName", () => {
    expect(parseClientNameForm({}).success).toBe(false);
  });
});

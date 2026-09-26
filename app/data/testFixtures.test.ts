import { describe, expect, it } from "vitest";
import { makeClient, makeInvoice, makeLineItem, makePayment } from "./testFixtures";

describe("testFixtures", () => {
  it("builds the canonical seed invoice the flow tests store", () => {
    expect(makeInvoice()).toEqual({
      date: "2026-01-01",
      from: { city: "", county: "", name: "", postCode: "", streetAddress: "" },
      id: "inv-1",
      lineItems: [{ qty: 2, type: "0", unitPrice: 50, uuid: "l1" }],
      logo: { url: "" },
      payments: [],
      purchaseOrder: "PO-1",
      to: { city: "", county: "", name: "Buyer", postCode: "", streetAddress: "" },
    });
  });

  it("applies invoice overrides on top of the defaults", () => {
    const invoice = makeInvoice({ id: "inv-2", purchaseOrder: "PO-2" });
    expect(invoice.id).toBe("inv-2");
    expect(invoice.purchaseOrder).toBe("PO-2");
    expect(invoice.date).toBe("2026-01-01");
  });

  it("builds line items on a stable default uuid", () => {
    expect(makeLineItem({ qty: 3, unitPrice: 25, type: "0" })).toEqual({ uuid: "l1", qty: 3, unitPrice: 25, type: "0" });
    expect(makeLineItem({ uuid: "l2" }).uuid).toBe("l2");
  });

  it("builds a payment with amount and date", () => {
    expect(makePayment()).toEqual({ amount: 100, date: "2026-01-01" });
    expect(makePayment({ amount: 42 }).amount).toBe(42);
  });

  it("builds a client with contact defaults", () => {
    const client = makeClient({ contactName: "Bob" });
    expect(client.contactName).toBe("Bob");
    expect(client.id).toBe("client-1");
    expect(client.address.streetAddress).toBe("1 Street");
  });
});

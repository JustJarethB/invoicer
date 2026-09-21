import { describe, expect, it } from "vitest";
import { makeClient, makeInvoice, makeLineItem, makePayment } from "./testFixtures";

describe("testFixtures", () => {
  it("builds the canonical seed invoice the flow tests store", () => {
    // The seeded JSON must stay byte-identical to the inline fixture the
    // notification flow tests used before the shared repository existed, so
    // fixture adoption cannot change stored-test behaviour.
    expect(JSON.stringify(makeInvoice())).toBe(
      '{"id":"inv-1","date":"2026-01-01","purchaseOrder":"PO-1","logo":{"url":""},"from":{"name":"","streetAddress":"","city":"","county":"","postCode":""},"to":{"name":"Buyer","streetAddress":"","city":"","county":"","postCode":""},"lineItems":[{"uuid":"l1","type":"0","qty":2,"unitPrice":50}],"payments":[]}'
    );
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
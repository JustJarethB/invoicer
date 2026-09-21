import { emptyAddress } from "./address";
import type { Client } from "./client";
import type { Invoice, LineItem, Payment } from "./invoice";

/**
 * Shared test-data builders (owner review: one global repository for test
 * data instead of per-test inline fixtures). Overrides replace a field
 * wholesale; defaults are the shapes the flow tests have always seeded.
 */
export const makeLineItem = (overrides: Partial<LineItem> = {}): LineItem => ({ uuid: "l1", ...overrides });

export const makePayment = (overrides: Partial<Payment> = {}): Payment => ({ amount: 100, date: "2026-01-01", ...overrides });

export const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: "client-1",
  contactName: "Acme",
  email: "acme@example.com",
  phone: "01234567890",
  address: { ...emptyAddress(), name: "Acme", streetAddress: "1 Street", city: "City", county: "County", postCode: "PC1 1AA" },
  ...overrides,
});

export const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: "inv-1",
  date: "2026-01-01",
  purchaseOrder: "PO-1",
  logo: { url: "" },
  from: emptyAddress(),
  to: { ...emptyAddress(), name: "Buyer" },
  lineItems: [makeLineItem({ type: "0", qty: 2, unitPrice: 50 })],
  payments: [],
  ...overrides,
});
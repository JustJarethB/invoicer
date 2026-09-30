import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { InvoiceSchema } from "./invoice";
import { ownerEmptyInvoiceFixture } from "./testFixtures";

const validNumeric = {
  id: "ok",
  date: "2026-01-01",
  purchaseOrder: "PO-1",
  logo: { url: "" },
  from: {},
  to: {},
  lineItems: [{ uuid: "l1", type: "0", qty: 2, unitPrice: 150 }],
  payments: [{ amount: 100, date: "2026-01-02" }],
};
const legacyString = {
  ...validNumeric,
  id: "legacy",
  lineItems: [{ uuid: "l1", type: "0", qty: "2", unitPrice: "150.00" }],
  payments: [{ amount: "100", date: "2026-01-02" }],
};
const malformed = { id: "bad", lineItems: "oops" };

const seed = (id: string, value: unknown) => localStorage.setItem(JSON.stringify(["invoice", id]), JSON.stringify(value));

describe("db validated read seam", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("coerces a legacy string-money record and preserves the stored JSON on read", async () => {
    seed("legacy", legacyString);
    const record = await db.getValidated(InvoiceSchema, ["invoice", "legacy"]);
    expect(record).not.toBeNull();
    if (!record) return;
    expect(record.lineItems[0].unitPrice).toBe(150);
    expect(record.lineItems[0].unitPrice).toBeTypeOf("number");
    expect(record.payments[0].amount).toBe(100);
    expect(localStorage.getItem(JSON.stringify(["invoice", "legacy"]))).toBe(JSON.stringify(legacyString));
  });

  it("returns null for a schema-failing record while the raw seam still returns the blob", async () => {
    seed("bad", malformed);
    const raw = await db.get(["invoice", "bad"]);
    expect(raw).toEqual(malformed);
    expect(await db.getValidated(InvoiceSchema, ["invoice", "bad"])).toBeNull();
  });

  it("drops schema-failing records from list reads and keeps key order", async () => {
    seed("z", { ...validNumeric, id: "z", lineItems: legacyString.lineItems });
    seed("a", { ...validNumeric, id: "a", lineItems: legacyString.lineItems });
    seed("wrong", { lineItems: "oops" });
    const records = await db.getAllValidated(InvoiceSchema, ["invoice"]);
    expect(records.map((record) => record.id)).toEqual(["a", "z"]);
  });

  it("treats a missing key and unparseable JSON as absent", async () => {
    expect(await db.getValidated(InvoiceSchema, ["invoice", "missing"])).toBeNull();
    localStorage.setItem(JSON.stringify(["invoice", "junk"]), "{not json");
    expect(await db.getValidated(InvoiceSchema, ["invoice", "junk"])).toBeNull();
  });

  it("keeps the owner's legacy empty-invoice record in a list read (logo.url stored as object)", async () => {
    seed("owner-legacy", ownerEmptyInvoiceFixture);
    const records = await db.getAllValidated(InvoiceSchema, ["invoice"]);
    expect(records.map((record) => record.id)).toEqual(["1785798307"]);
    expect(records[0].logo).toEqual({ url: "" });
    expect(localStorage.getItem(JSON.stringify(["invoice", "owner-legacy"]))).toBe(JSON.stringify(ownerEmptyInvoiceFixture));
  });
});

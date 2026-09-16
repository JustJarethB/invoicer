import { describe, expect, it } from "vitest";
import { db } from "./db";
import { emptyAddress } from "./data/address";
import type { Invoice } from "./data/invoice";

const makeInvoice = (id: string): Invoice => ({
  date: "2026-01-01",
  from: emptyAddress(),
  id,
  lineItems: [{ qty: 2, type: "0", unitPrice: 150, uuid: "l1" }],
  logo: { url: "" },
  payments: [],
  purchaseOrder: "PO-1",
  to: emptyAddress(),
});

describe("db", () => {
  it("saves and retrieves a value by key", async () => {
    // localStorage is the persistence layer for the whole app; round-trips must be reliable.
    await db.save(["invoice", "123"], makeInvoice("123"));
    const result = await db.get(["invoice", "123"]);
    expect(result).toEqual(makeInvoice("123"));
  });

  it("returns null for a missing key", async () => {
    // Callers rely on this to fall back to defaults (e.g. NULL_CLIENT or empty payment details).
    const result = await db.get(["invoice", "missing"]);
    expect(result).toBeNull();
  });

  it("removes a value by key", async () => {
    await db.save(["invoice", "456"], makeInvoice("456"));
    await db.remove(["invoice", "456"]);
    const result = await db.get(["invoice", "456"]);
    expect(result).toBeNull();
  });

  it("returns all values matching a partial key", async () => {
    // The invoice list and client list rely on partial matching against namespaced keys.
    await db.save(["invoice", "a"], makeInvoice("a"));
    await db.save(["invoice", "b"], makeInvoice("b"));

    const invoices = await db.getAll(["invoice"]);
    expect(invoices).toHaveLength(2);
    expect(invoices.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });

  it("sorts getAll results by key", async () => {
    // Sorting gives a stable order for lists, which matters for snapshot and UI consistency.
    await db.save(["invoice", "z"], makeInvoice("z"));
    await db.save(["invoice", "a"], makeInvoice("a"));

    const invoices = await db.getAll(["invoice"]);
    expect(invoices.map((i) => i.id)).toEqual(["a", "z"]);
  });

  it("returns null for stored data that is not valid JSON", async () => {
    // A corrupt blob must never reach a consumer typed as Invoice; the old
    // JSON.parse threw uncaught at read time.
    localStorage.setItem(JSON.stringify(["invoice", "corrupt"]), "{not json");
    const result = await db.get(["invoice", "corrupt"]);
    expect(result).toBeNull();
  });

  it("returns null for stored data that fails its domain schema", async () => {
    // A partial save or manual edit previously masqueraded as a valid record;
    // validate-on-read rejects it (audit S1).
    localStorage.setItem(JSON.stringify(["invoice", "bad"]), JSON.stringify({ id: "bad" }));
    const result = await db.get(["invoice", "bad"]);
    expect(result).toBeNull();
  });

  it("filters records that fail validation out of getAll", async () => {
    // One corrupt record must not poison the whole invoice list (audit S4/G6).
    await db.save(["invoice", "good"], makeInvoice("good"));
    localStorage.setItem(JSON.stringify(["invoice", "bad"]), JSON.stringify({ nope: true }));

    const invoices = await db.getAll(["invoice"]);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].id).toBe("good");
  });

  it("rejects a save whose data fails its domain schema", async () => {
    // Write-side validation (audit G7): corrupt data is stopped at the door.
    const bad = makeInvoice("bad");
    (bad.lineItems[0] as { qty: unknown }).qty = "not-a-number";
    const result = await db.save(["invoice", "bad"], bad as Invoice);
    expect(result).toBe(false);
    expect(await db.get(["invoice", "bad"])).toBeNull();
  });

  it("tolerates a non-array localStorage key while scanning", async () => {
    // A numeric-looking key parses to a number; the scan must skip it, not throw.
    localStorage.setItem("123", JSON.stringify(makeInvoice("x")));
    const invoices = await db.getAll(["invoice"]);
    expect(invoices).toHaveLength(0);
  });
});

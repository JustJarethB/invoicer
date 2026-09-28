import { describe, expect, it } from "vitest";
import { db } from "./db";
import { emptyAddress } from "./data/address";
import type { Invoice } from "./data/invoice";
import { ownerEmptyInvoiceFixture } from "./data/testFixtures";

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
  it("keeps the owner empty-invoice fixture visible beside valid and corrupt records", async () => {
    const ownerKey = JSON.stringify(["invoice", ownerEmptyInvoiceFixture.id]);
    const corruptKey = JSON.stringify(["invoice", "corrupt-neighbour"]);
    localStorage.setItem(ownerKey, JSON.stringify(ownerEmptyInvoiceFixture));
    localStorage.setItem(corruptKey, "{not json");
    await db.save(["invoice", "valid-neighbour"], makeInvoice("valid-neighbour"));

    const loaded = await db.get(["invoice", ownerEmptyInvoiceFixture.id]);
    expect(loaded).toEqual({
      ...ownerEmptyInvoiceFixture,
      from: emptyAddress(),
      lineItems: [{ qty: undefined, unitPrice: undefined, uuid: "89eac997-5d56-438e-9f28-dbfa98db3a2b", vatRate: undefined }],
      logo: { url: "" },
      payment: { bankName: "", emailAddress: "", info: "", number: "", phoneNumber: "", sortCode: "", terms: "", type: "" },
      to: emptyAddress(),
    });
    expect(JSON.parse(localStorage.getItem(ownerKey) ?? "null")).toEqual(ownerEmptyInvoiceFixture);
    expect((await db.getAll(["invoice"])).map((invoice) => invoice.id)).toEqual([ownerEmptyInvoiceFixture.id, "valid-neighbour"]);
    expect(localStorage.getItem(corruptKey)).toBe("{not json");

    if (!loaded) throw new Error("Owner fixture did not load");
    expect(await db.save(["invoice", ownerEmptyInvoiceFixture.id], loaded)).toBe(true);
    expect(await db.get(["invoice", ownerEmptyInvoiceFixture.id])).toEqual(loaded);
    expect(JSON.parse(localStorage.getItem(ownerKey) ?? "null")).toEqual(loaded);
  });

  it("saves and retrieves a value by key", async () => {
    // localStorage is the persistence layer for the whole app; round-trips must be reliable.
    await db.save(["invoice", "123"], makeInvoice("123"));
    const result = await db.get(["invoice", "123"]);
    expect(result).toEqual(makeInvoice("123"));
  });

  it("loads invoices written by the earlier editor with its double-wrapped logo", async () => {
    // The old editor constructed logo: { url: logo } where logo was already
    // the autosaved { url: string } record. Validate without losing the invoice.
    const legacy = { ...makeInvoice("legacy"), logo: { url: { url: "data:image/png;base64,aGVsbG8=" } } };
    localStorage.setItem(JSON.stringify(["invoice", "legacy"]), JSON.stringify(legacy));
    expect((await db.get(["invoice", "legacy"]))?.logo).toEqual({ url: "data:image/png;base64,aGVsbG8=" });
    expect((await db.getAll(["invoice"])).map((invoice) => invoice.id)).toContain("legacy");
    localStorage.setItem(JSON.stringify(["invoice", "no-logo"]), JSON.stringify({ ...legacy, id: "no-logo", logo: { url: {} } }));
    expect((await db.get(["invoice", "no-logo"]))?.logo).toEqual({ url: "" });
  });

  it("loads numeric strings from a legacy invoice as numbers", async () => {
    const legacy = {
      ...makeInvoice("legacy-numbers"),
      lineItems: [{ uuid: "l1", type: "0", qty: "2", unitPrice: "150.25", vatRate: "20" }],
      payments: [{ date: "2026-01-02", amount: "12.50" }],
    };
    const key = JSON.stringify(["invoice", "legacy-numbers"]);
    localStorage.setItem(key, JSON.stringify(legacy));

    const loaded = await db.get(["invoice", "legacy-numbers"]);
    expect(loaded?.lineItems[0]).toMatchObject({ qty: 2, unitPrice: 150.25, vatRate: 20 });
    expect(loaded?.payments?.[0].amount).toBe(12.5);
    expect((await db.getAll(["invoice"])).map((invoice) => invoice.id)).toContain("legacy-numbers");
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual(legacy);
    if (!loaded) throw new Error("Legacy invoice did not load");
    expect(await db.save(["invoice", "legacy-numbers"], loaded)).toBe(true);
    expect(JSON.parse(localStorage.getItem(key) ?? "null").lineItems[0].qty).toBe(2);
  });

  it("treats blank legacy optional numbers as absent, not zero", async () => {
    const legacy = {
      ...makeInvoice("blank-numbers"),
      lineItems: [{ uuid: "l1", type: "0", qty: "", unitPrice: "   ", vatRate: "" }],
    };
    localStorage.setItem(JSON.stringify(["invoice", "blank-numbers"]), JSON.stringify(legacy));
    expect((await db.get(["invoice", "blank-numbers"]))?.lineItems[0]).toMatchObject({
      uuid: "l1",
      type: "0",
      qty: undefined,
      unitPrice: undefined,
      vatRate: undefined,
    });
  });

  it("does not coerce malformed or non-finite numeric text", async () => {
    for (const text of ["£12", "12oops", "Infinity", "1e309", "  "]) {
      const invoice = { ...makeInvoice(text), payments: [{ date: "2026-01-02", amount: text }] };
      localStorage.setItem(JSON.stringify(["invoice", text]), JSON.stringify(invoice));
      expect(await db.get(["invoice", text])).toBeNull();
    }
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

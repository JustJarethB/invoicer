import { describe, expect, it } from "vitest";
import { db } from "./db";

describe("db", () => {
  it("saves and retrieves a value by key", async () => {
    // localStorage is the persistence layer for the whole app; round-trips must be reliable.
    await db.save(["invoice", "123"], { id: "123", total: 100 });
    const result = await db.get(["invoice", "123"]);
    expect(result).toEqual({ id: "123", total: 100 });
  });

  it("returns null for a missing key", async () => {
    // Callers rely on this to fall back to defaults (e.g. NULL_CLIENT or empty payment details).
    const result = await db.get(["invoice", "missing"]);
    expect(result).toBeNull();
  });

  it("removes a value by key", async () => {
    await db.save(["invoice", "456"], { id: "456" });
    await db.remove(["invoice", "456"]);
    const result = await db.get(["invoice", "456"]);
    expect(result).toBeNull();
  });

  it("returns all values matching a partial key", async () => {
    // The invoice list and client list rely on partial matching against namespaced keys.
    await db.save(["invoice", "a"], { id: "a" });
    await db.save(["invoice", "b"], { id: "b" });
    await db.save(["client", "c"], { id: "c" });

    const invoices = await db.getAll<{ id: string }>(["invoice"]);
    expect(invoices).toHaveLength(2);
    expect(invoices.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });

  it("sorts getAll results by key", async () => {
    // Sorting gives a stable order for lists, which matters for snapshot and UI consistency.
    await db.save(["invoice", "z"], { id: "z" });
    await db.save(["invoice", "a"], { id: "a" });

    const invoices = await db.getAll<{ id: string }>(["invoice"]);
    expect(invoices.map((i) => i.id)).toEqual(["a", "z"]);
  });
});

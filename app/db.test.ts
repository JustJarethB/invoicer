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

describe("db.storedIds", () => {
  it("returns the stored ids for a domain key namespace", async () => {
    await db.save(["clients", "c1"], { id: "c1" });
    await db.save(["clients", "c2"], { id: "c2" });
    await db.save(["invoice", "i1"], { id: "i1" });

    expect(await db.storedIds("clients")).toEqual(["c1", "c2"]);
  });

  it("skips unreadable, wrong-shape, and empty-id key segments", async () => {
    localStorage.setItem("not-json", "x"); // unparseable: matchPartialKeys warns and skips it
    localStorage.setItem(JSON.stringify(["clients"]), '["one segment"]');
    localStorage.setItem(JSON.stringify(["clients", "a", "b"]), "{}");
    localStorage.setItem(JSON.stringify(["clients", ""]), "x");
    localStorage.setItem('["clients", 5]', "x");
    localStorage.setItem(JSON.stringify(["clients", "ok"]), "{}");

    expect(await db.storedIds("clients")).toEqual(["ok"]);
  });

  it("dedupes ids reached by different raw keys", async () => {
    localStorage.setItem(JSON.stringify(["clients", "dup"]), "x");
    // Same segments, non-canonical raw key: both parse to the same id.
    localStorage.setItem('["clients", "dup"]', "y");

    expect(await db.storedIds("clients")).toEqual(["dup"]);
  });
});

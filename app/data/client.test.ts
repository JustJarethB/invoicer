import { describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { type Client, deleteClient, getClients, NULL_CLIENT, saveClient } from "./client";
import { emptyAddress } from "./address";

describe("client data layer", () => {
  const makeClient = (id: string, contactName: string): Client => ({
    id,
    contactName,
    email: `${contactName}@example.com`,
    phone: "01234567890",
    address: { ...emptyAddress(), name: contactName, streetAddress: "1 Street", city: "City", county: "County", postCode: "PC1 1AA" },
  });

  it("saves a client and tracks it in clientKeys", async () => {
    // The dropdown on the invoice page relies on clientKeys to enumerate saved clients.
    await saveClient("client-1", makeClient("client-1", "Alice"));
    const keys = await db.get(["clientKeys"]);
    expect(keys).toContain("client-1");
  });

  it("returns all saved clients via getClients", async () => {
    await saveClient("client-1", makeClient("client-1", "Alice"));
    await saveClient("client-2", makeClient("client-2", "Bob"));

    const clients = await getClients();
    expect(clients).toHaveLength(2);
    expect(clients.map((c) => c.contactName).sort()).toEqual(["Alice", "Bob"]);
  });

  it("does not duplicate keys when saving the same client twice", async () => {
    // Re-saving a client should not grow the key list, which would pollute the dropdown.
    await saveClient("client-1", makeClient("client-1", "Alice"));
    await saveClient("client-1", makeClient("client-1", "Alice Updated"));

    const keys = await db.get(["clientKeys"]);
    expect(keys).toEqual(["client-1"]);
  });

  it("deletes a client and removes its key", async () => {
    await saveClient("client-1", makeClient("client-1", "Alice"));
    await deleteClient("client-1");

    const keys = await db.get(["clientKeys"]);
    expect(keys).not.toContain("client-1");

    const client = await db.get(["clients", "client-1"]);
    expect(client).toBeNull();
  });

  it("returns an id-bearing placeholder when a stored client record is missing", async () => {
    // getClients falls back to NULL_CLIENT if a key exists but the record does
    // not, but the placeholder must keep the key's id: NULL_CLIENT has id ""
    // and cannot be identified in the UI, and empty ids could collide.
    await saveClient("ghost", makeClient("ghost", "Ghost"));
    await db.remove(["clients", "ghost"]);

    const clients = await getClients();
    expect(clients).toHaveLength(1);
    expect(clients[0].id).toBe("ghost");
    expect(clients[0].contactName).toBe("");
    expect(clients[0]).toEqual({ ...NULL_CLIENT, id: "ghost" });
  });

  it("treats a missing clientKeys index as a first write, not corruption", async () => {
    // An absent index has nothing to rebuild from; saving the first client
    // creates it with just that key.
    await saveClient("client-1", makeClient("client-1", "Alice"));

    const raw = JSON.parse(localStorage.getItem(JSON.stringify(["clientKeys"])) as string);
    expect(raw).toEqual(["client-1"]);
  });

  it("rebuilds a corrupt clientKeys index from stored client keys on save", async () => {
    // A corrupt index blob must not read as "no clients saved": the next save
    // would overwrite the index with only the new key and permanently orphan
    // every previously saved client. saveClient rebuilds the index from the
    // client storage keys on disk instead.
    await saveClient("client-1", makeClient("client-1", "Alpha"));
    await saveClient("client-2", makeClient("client-2", "Beta"));
    localStorage.setItem(JSON.stringify(["clientKeys"]), "{corrupt");

    await saveClient("client-3", makeClient("client-3", "Gamma"));

    const raw = JSON.parse(localStorage.getItem(JSON.stringify(["clientKeys"])) as string);
    expect(raw.sort()).toEqual(["client-1", "client-2", "client-3"]);
  });

  it("rebuilds a corrupt clientKeys index from stored client keys on delete", async () => {
    // deleteClient writes the filtered index too, so it must also start from
    // the rebuilt index, not from an empty list.
    await saveClient("client-1", makeClient("client-1", "Alpha"));
    await saveClient("client-2", makeClient("client-2", "Beta"));
    await db.remove(["clients", "client-1"]);
    localStorage.setItem(JSON.stringify(["clientKeys"]), "{corrupt");

    await deleteClient("client-2");

    const raw = JSON.parse(localStorage.getItem(JSON.stringify(["clientKeys"])) as string);
    expect(raw).toEqual([]);
  });

  it("keeps a key whose stored record is unreadable (rebuild keeps the key)", async () => {
    // The rebuild scans localStorage keys, not records: a key whose record is
    // unreadable must survive a rebuild so the placeholder path can still
    // surface it. (The ghost is created by corrupting the record VALUE, which
    // keeps its storage key; a record removed via db.remove takes its key
    // along — nothing remains to rebuild from, see the test below.)
    await saveClient("client-1", makeClient("client-1", "Alpha"));
    await saveClient("client-2", makeClient("client-2", "Beta"));
    localStorage.setItem(JSON.stringify(["clients", "client-1"]), "{corrupt");
    localStorage.setItem(JSON.stringify(["clientKeys"]), "{corrupt");

    await saveClient("client-3", makeClient("client-3", "Gamma"));

    const clients = await getClients();
    expect(clients.map((c) => c.id).sort()).toEqual(["client-1", "client-2", "client-3"]);
  });

  it("does not resurrect a client whose record and storage key are both gone", async () => {
    // db.remove deletes the storage key itself. After a corrupt-index rebuild
    // nothing references the removed client, so it stays deleted — the rebuild
    // cannot invent keys that no longer exist anywhere.
    await saveClient("client-1", makeClient("client-1", "Alpha"));
    await saveClient("client-2", makeClient("client-2", "Beta"));
    await db.remove(["clients", "client-1"]);
    localStorage.setItem(JSON.stringify(["clientKeys"]), "{corrupt");

    await saveClient("client-3", makeClient("client-3", "Gamma"));

    const clients = await getClients();
    expect(clients.map((c) => c.id).sort()).toEqual(["client-2", "client-3"]);
  });

  it("throws instead of reporting success when saving the client record is rejected", async () => {
    // db.save resolves false when persistence fails; saveClient must not let
    // the caller read a success from that (withErrorReporting callers turn the
    // throw into the client failed event). Reachable only via a false result,
    // so the test drives it through a spy.
    vi.spyOn(db, "save").mockResolvedValue(false);
    await expect(saveClient("client-1", makeClient("client-1", "Alpha"))).rejects.toThrow("Client could not be saved");
  });

  it("throws instead of reporting success when saving the index is rejected", async () => {
    // The index write-back uses db.save too; a false result must throw before
    // saveClient returns, for the same reason as above.
    vi.spyOn(db, "save").mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(saveClient("client-1", makeClient("client-1", "Alpha"))).rejects.toThrow("Client index could not be saved");
  });

  it("throws instead of reporting success when deleting the client record is rejected", async () => {
    vi.spyOn(db, "remove").mockResolvedValue(false);
    await expect(deleteClient("client-1")).rejects.toThrow("Client could not be deleted");
  });
});

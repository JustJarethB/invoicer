import { describe, expect, it } from "vitest";
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

  it("returns a placeholder that keeps the id when a stored client record is missing", async () => {
    // A key whose record is missing must stay identifiable: falling back to
    // NULL_CLIENT erases the id, which leaves an unidentifiable empty card in
    // the UI and collides with other empty-id cards (audit G5).
    await saveClient("ghost", makeClient("ghost", "Ghost"));
    await db.remove(["clients", "ghost"]);

    const clients = await getClients();
    const ghost = clients.find((c) => c.id === "ghost");
    expect(ghost).toBeDefined();
    expect(ghost).not.toEqual(NULL_CLIENT);
    expect(ghost?.contactName).toBe("");
  });

  it("rebuilds a corrupt clientKeys index from stored client records on save", async () => {
    // A corrupt index blob must not read as "no clients saved": the next save
    // would overwrite the index with only the new key and permanently orphan
    // every previously saved client. saveClient rebuilds the index from the
    // client records on disk instead.
    await saveClient("client-1", makeClient("client-1", "Alpha"));
    await saveClient("client-2", makeClient("client-2", "Beta"));
    localStorage.setItem(JSON.stringify(["clientKeys"]), "{corrupt");

    await saveClient("client-3", makeClient("client-3", "Gamma"));

    const clients = await getClients();
    expect(clients.map((c) => c.contactName).sort()).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("rebuilds a corrupt clientKeys index from stored client records on delete", async () => {
    // deleteClient writes the filtered index too, so it must also start from
    // the rebuilt index, not from an empty list.
    await saveClient("client-1", makeClient("client-1", "Alpha"));
    await saveClient("client-2", makeClient("client-2", "Beta"));
    localStorage.setItem(JSON.stringify(["clientKeys"]), "{corrupt");

    await deleteClient("client-1");

    const clients = await getClients();
    expect(clients.map((c) => c.contactName).sort()).toEqual(["Beta"]);
  });

  it("treats a missing clientKeys index as a first write, not a corruption", async () => {
    // Fresh storage has no index at all; that is a genuine first write and
    // must not log a rebuild error or try to scan records.
    await saveClient("client-1", makeClient("client-1", "Alpha"));
    const keys = await db.get(["clientKeys"]);
    expect(keys).toEqual(["client-1"]);
  });

  it("keeps an index whose stored record is missing (rebuild keeps the key)", async () => {
    // The rebuild scans client records; a key whose record is missing must
    // not vanish from the index just because its record is gone.
    await saveClient("client-1", makeClient("client-1", "Alpha"));
    await saveClient("client-2", makeClient("client-2", "Beta"));
    await db.remove(["clients", "client-1"]);
    localStorage.setItem(JSON.stringify(["clientKeys"]), "{corrupt");

    await saveClient("client-3", makeClient("client-3", "Gamma"));

    const clients = await getClients();
    expect(clients.map((c) => c.id).sort()).toEqual(["client-2", "client-3"]);
  });
});

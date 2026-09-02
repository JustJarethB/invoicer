import { describe, expect, it } from "vitest";
import { db } from "../db";
import { deleteClient, getClients, NULL_CLIENT, saveClient, type Client } from "./client";
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

  it("returns a placeholder when a stored client record is missing", async () => {
    // getClients falls back to NULL_CLIENT if a key exists but the record does not.
    // This prevents the Promise.all from throwing, but the resulting entry has an empty id.
    await saveClient("ghost", makeClient("ghost", "Ghost"));
    await db.remove(["clients", "ghost"]);

    const clients = await getClients();
    expect(clients).toHaveLength(1);
    expect(clients[0]).toEqual(NULL_CLIENT);
  });

  it.skip("preserves the client id when the stored record is missing", async () => {
    // TODO: This test documents a bug. When a client key exists but the record is missing,
    // getClients returns NULL_CLIENT with an empty id. This creates an unidentifiable empty
    // client card in the UI and can cause React key collisions. The key should be preserved
    // so the entry remains identifiable. See app/data/client.ts:getClients.
    await saveClient("ghost", makeClient("ghost", "Ghost"));
    await db.remove(["clients", "ghost"]);

    const clients = await getClients();
    const ghost = clients.find((c) => c.id === "ghost");
    expect(ghost).toBeDefined();
    expect(ghost).not.toEqual(NULL_CLIENT);
  });
});

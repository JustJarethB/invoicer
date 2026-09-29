import { z } from "zod/mini";
import { db } from "~/db";
import { AddressSchema, emptyAddress } from "./address";
import { logger } from "~/utils/logger";

/**
 * Schema for a persisted Client record (the clients Autosave key's domain).
 * Contact fields are strict strings, matching every known writer: the clients
 * form serializes all five keys as strings, so no legacy partial-client
 * tolerance exists to preserve (see issue #43 thread; #48 shipped the same
 * strict shape). A failing client record falls back to NULL_CLIENT.
 */
export const ClientSchema = z.object({
  address: AddressSchema,
  contactName: z.string(),
  email: z.string(),
  id: z.string(),
  phone: z.string(),
});

/** Schema for the persisted client-key index record. */
export const ClientKeysSchema = z.array(z.string());

export type Client = z.infer<typeof ClientSchema>;
export const NULL_CLIENT: Client = {
  id: "",
  contactName: "",
  email: "",
  phone: "",
  address: emptyAddress(),
};

export const saveClient = async (key: string, client: Client) => {
  // This read feeds a write-back, not a component: a validated read that
  // failed (→ null → []) would silently rewrite the index to only `key`,
  // wiping every other client (the same loss class this issue fixes, from the
  // other side). Keep the raw read for exact pre-seam parity; the UI-facing
  // list read in getClients is the validated path.
  const data = (await db.get<string[]>(["clientKeys"])) ?? [];
  await db.save(["clients", key], client);
  await db.save(["clientKeys"], Array.from(new Set([...data, key])));
};
export const deleteClient = async (key: string) => {
  const data = (await db.get<string[]>(["clientKeys"])) ?? [];
  await db.save(
    ["clientKeys"],
    data.filter((item: string) => item !== key)
  );
  await db.remove(["clients", key]);
};

export const getClients = async (): Promise<Client[]> => {
  const keys = (await db.getValidated(ClientKeysSchema, ["clientKeys"])) ?? [];
  const clients = await Promise.all(
    keys.map(async (key: string) => {
      return (await db.getValidated(ClientSchema, ["clients", key])) ?? NULL_CLIENT;
    })
  );
  logger.debug("Loaded clients:", clients);
  return clients;
};

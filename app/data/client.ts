import { z } from "zod/mini";
import { db } from "~/db";
import { AddressSchema, emptyAddress } from "./address";
import { logger } from "~/utils/logger";

export const ClientSchema = z.object({
  address: AddressSchema,
  contactName: z.string(),
  email: z.string(),
  id: z.string(),
  phone: z.string(),
});

export const ClientKeysSchema = z.array(z.string());

export type Client = z.infer<typeof ClientSchema>;
export const NULL_CLIENT: Client = {
  id: "",
  contactName: "",
  email: "",
  phone: "",
  address: emptyAddress(),
};

/**
 * Read the client-key index, distinguishing "absent" from "invalid".
 *
 * The raw presence check is the only way to tell the two cases apart:
 * getValidated returns null for both. An absent index is a genuine first
 * write. An existing-but-invalid blob must never read as "no clients saved",
 * because the next write would overwrite the index with only the new key and
 * permanently orphan every previously saved client. On an invalid blob the
 * index is rebuilt from the `["clients", key]` localStorage keys actually
 * present (db.storedIds) — ids come from the keys alone, so keys whose
 * records are missing or unreadable survive the rebuild. The index is read
 * only through getValidated: raw JSON.parse throws on a corrupt blob.
 */
const readClientKeys = async (): Promise<string[]> => {
  const keys = await db.getValidated(ClientKeysSchema, ["clientKeys"]);
  if (keys !== null) return keys;
  if (typeof localStorage === "undefined") return [];
  if (localStorage.getItem(JSON.stringify(["clientKeys"])) === null) return [];
  logger.error("clientKeys index failed validation; rebuilding it from stored client keys.");
  return db.storedIds("clients");
};

export const saveClient = async (key: string, client: Client) => {
  const keys = await readClientKeys();
  if (!(await db.save(["clients", key], client))) throw new Error("Client could not be saved");
  if (!(await db.save(["clientKeys"], Array.from(new Set([...keys, key]))))) throw new Error("Client index could not be saved");
};
export const deleteClient = async (key: string) => {
  const keys = await readClientKeys();
  if (
    !(await db.save(
      ["clientKeys"],
      keys.filter((item) => item !== key)
    ))
  ) {
    throw new Error("Client index could not be saved");
  }
  if (!(await db.remove(["clients", key]))) throw new Error("Client could not be deleted");
};

export const getClients = async (): Promise<Client[]> => {
  const keys = await readClientKeys();
  const clients = await Promise.all(
    keys.map(async (key: string) => {
      // A key whose record is missing or unreadable must stay identifiable:
      // dropping to NULL_CLIENT erases the id, which makes the UI card
      // unrenderable and collides with other empty-id cards (audit G5).
      // The placeholder shell keeps the key's id.
      return (await db.getValidated(ClientSchema, ["clients", key])) ?? { ...NULL_CLIENT, id: key };
    })
  );
  logger.debug("Loaded clients:", clients);
  return clients;
};

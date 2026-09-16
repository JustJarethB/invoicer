import { db } from "~/db";
import { emptyAddress } from "./address";
import { logger } from "~/utils/logger";
import { type Client, parseClientForm } from "./schemas";

export const NULL_CLIENT: Client = {
  address: emptyAddress(),
  contactName: "",
  email: "",
  id: "",
  phone: "",
};

/**
 * Read the client-key index, distinguishing "absent" from "invalid".
 *
 * `db.get` returns null for both cases, but a corrupt (invalid) index blob
 * must not be treated as "no clients saved": the next write would overwrite
 * the index with only the new key and permanently orphan every previously
 * saved client. On an invalid blob the index is rebuilt from the
 * `["clients", key]` localStorage keys actually present — the same partial-key
 * scan db.getAll uses — so the index can never silently drop reachable
 * clients, including keys whose stored record is missing or unreadable.
 */
const readClientKeys = async (): Promise<string[]> => {
  const keys = await db.get(["clientKeys"]);
  if (keys !== null) {
    return keys;
  }
  const raw = localStorage.getItem(JSON.stringify(["clientKeys"]));
  if (raw === null) {
    // Genuine first write: the index has never existed.
    return [];
  }
  // A blob exists but failed its schema: rebuild the index from the client
  // storage keys on disk so a corrupt index cannot orphan saved clients. The
  // scan reads ids from the keys themselves, so a key survives even when its
  // record is missing.
  logger.error("clientKeys index failed validation; rebuilding it from stored client keys.");
  return db.storedIds("clients");
};

export const saveClient = async (key: string, client: Client) => {
  const keys = await readClientKeys();
  await db.save(["clients", key], client);
  await db.save(["clientKeys"], Array.from(new Set([...keys, key])));
};
export const deleteClient = async (key: string) => {
  const keys = await readClientKeys();
  await db.save(
    ["clientKeys"],
    keys.filter((item) => item !== key)
  );
  await db.remove(["clients", key]);
};

export const getClients = async (): Promise<Client[]> => {
  const keys = await readClientKeys();
  const clients = await Promise.all(
    keys.map(async (key) => {
      const client = await db.get(["clients", key]);
      // A key whose record is missing must stay identifiable: dropping to
      // NULL_CLIENT erases the id, which makes the UI card unrenderable and
      // collides with other empty-id cards (audit G5). Fall back to a shell
      // that keeps the key's id.
      if (client === null) {
        logger.warn(`Stored client record for key ${key} is missing; returning a placeholder with the key's id.`);
        return { ...NULL_CLIENT, id: key };
      }
      return client;
    })
  );
  logger.debug("Loaded clients:", clients);
  return clients;
};

/** Validate a clients-page contact form record; throws on invalid input. */
export const clientFromForm = (record: Record<string, string>) => {
  const parsed = parseClientForm(record);
  if (!parsed.success) {
    throw new Error("Client form is missing a required field (contactName, email, phone)");
  }
  return parsed.data;
};

export type { Client };

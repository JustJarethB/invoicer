import { z } from "zod/mini";
import { db } from "~/db";
import { type Address, AddressSchema, emptyAddress } from "./address";
import { eventBus } from "~/utils/events";
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

export const saveClient = async (key: string, client: Client) => {
  // This raw read feeds a write-back: a schema-failing read would yield []
  // and silently wipe every other client from the index.
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

/**
 * Resolve a picked client id to the "To" address: a known id populates the
 * address, an unknown one clears it back to the canonical empty shape and
 * publishes a warning toast instead of leaving stale data behind.
 */
export const createClientAddressLoader =
  (clients: Client[], setAddress: (address: Address) => void) =>
  (clientId: string): void => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setAddress(client.address);
      return;
    }
    setAddress(emptyAddress());
    eventBus.publish({ type: "client", severity: "warning", message: "Selected client could not be found", context: { clientId, action: "not-found" } });
  };

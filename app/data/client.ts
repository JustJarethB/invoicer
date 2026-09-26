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

export const saveClient = async (key: string, client: Client) => {
  const data = (await db.get(["clientKeys"])) ?? [];
  await db.save(["clients", key], client);
  await db.save(["clientKeys"], Array.from(new Set([...data, key])));
};
export const deleteClient = async (key: string) => {
  const data = (await db.get(["clientKeys"])) ?? [];
  await db.save(
    ["clientKeys"],
    data.filter((item) => item !== key)
  );
  await db.remove(["clients", key]);
};

export const getClients = async (): Promise<Client[]> => {
  const keys = (await db.get(["clientKeys"])) ?? [];
  const clients = await Promise.all(
    keys.map(async (key) => {
      return (await db.get(["clients", key])) ?? NULL_CLIENT;
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

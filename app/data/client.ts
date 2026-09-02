import { db } from "~/db";
import { emptyAddress, type Address } from "./address";
import { logger } from "~/utils/logger";

export type Client = {
  id: string;
  contactName: string;
  email: string;
  phone: string;
  address: Address;
};
export const NULL_CLIENT: Client = {
  id: "",
  contactName: "",
  email: "",
  phone: "",
  address: emptyAddress(),
};

export const saveClient = async (key: string, client: Client) => {
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
  const keys = (await db.get<string[]>(["clientKeys"])) ?? [];
  const clients = await Promise.all(
    keys.map(async (key: string) => {
      return (await db.get<Client>(["clients", key])) ?? NULL_CLIENT;
    })
  );
  logger.debug("Loaded clients:", clients);
  return clients;
};

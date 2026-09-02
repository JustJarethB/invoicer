import { emptyAddress } from "~/data/address";
import type { Client } from "~/data/client";
import type { Page } from "@playwright/test";

export const clientFixture = (overrides?: Partial<Client>): Client => ({
  id: "client-1",
  contactName: "Acme Corp",
  email: "billing@acme.test",
  phone: "01234567890",
  address: { ...emptyAddress(), name: "Acme Corp", streetAddress: "1 Acme Way", city: "Acmeville", postCode: "AC1 1ME" },
  ...overrides,
});

export async function seedClient(page: Page, client = clientFixture()) {
  // localStorage requires a real origin; navigate first.
  await page.goto("/");
  await page.evaluate((data) => {
    localStorage.setItem(JSON.stringify(["clients", data.id]), JSON.stringify(data));
    const existingKeys = JSON.parse(localStorage.getItem(JSON.stringify(["clientKeys"])) ?? "[]") as string[];
    localStorage.setItem(JSON.stringify(["clientKeys"]), JSON.stringify(Array.from(new Set([...existingKeys, data.id]))));
  }, client);
}

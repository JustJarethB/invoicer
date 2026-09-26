import { type Address, addressSchema, type FormRecord } from "./schemas";
import { z } from "zod/mini";

/**
 * Address is derived from the zod schema in `~/data/schemas` and re-exported
 * here so the rest of the app keeps importing it from this module.
 */
export type { Address };

export const emptyAddress = (): Address => ({
  city: "",
  county: "",
  name: "",
  postCode: "",
  streetAddress: "",
});

/**
 * Build an Address from a plain key/value record. The record passes through
 * the address schema, so unknown fields are stripped and missing fields are
 * rejected — the caller decides the fallback, not a cast.
 */
export const addressFromRecord = (record: FormRecord): Address | null => {
  const parsed = z.safeParse(addressSchema, record);
  return parsed.success ? parsed.data : null;
};

const ADDRESS_FIELDS = ["name", "streetAddress", "city", "county", "postCode"] as const;

/**
 * Read the five address fields from a form. Reads only the fields Address knows
 * about, so it cannot pick up unrelated inputs the way a generic form-to-record
 * helper can. FormDataEntryValue is `string | File | null`; a File cannot
 * appear for these text inputs, so the entry is checked at runtime and an
 * impossible value falls back to "" instead of being cast.
 */
export const formJsonAddress = (form: HTMLFormElement): Address => {
  const fd = new FormData(form);
  const record: Record<string, string> = {};
  for (const field of ADDRESS_FIELDS) {
    const value: FormDataEntryValue | null = fd.get(field);
    record[field] = typeof value === "string" ? value : "";
  }
  const parsed = z.safeParse(addressSchema, record);
  return parsed.success ? parsed.data : emptyAddress();
};

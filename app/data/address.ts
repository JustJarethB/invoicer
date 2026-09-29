import { z } from "zod/mini";

export const addressSchema = z.object({
  city: z._default(z.string(), ""),
  county: z._default(z.string(), ""),
  name: z._default(z.string(), ""),
  postCode: z._default(z.string(), ""),
  streetAddress: z._default(z.string(), ""),
});

export type Address = z.output<typeof addressSchema>;

export const emptyAddress = (): Address => ({
  name: "",
  streetAddress: "",
  city: "",
  county: "",
  postCode: "",
});

/**
 * Build an Address from a plain key/value record. Unknown or missing fields
 * fall back to empty strings so callers never need an `as unknown as Address` cast.
 */
export const addressFromRecord = (record: Record<string, string>): Address => ({
  name: record.name ?? "",
  streetAddress: record.streetAddress ?? "",
  city: record.city ?? "",
  county: record.county ?? "",
  postCode: record.postCode ?? "",
});

const ADDRESS_FIELDS = ["name", "streetAddress", "city", "county", "postCode"] as const;

/**
 * Read the five address fields from a form. Reads only the fields Address knows
 * about, so it cannot pick up unrelated inputs the way a generic form-to-record
 * helper can.
 */
export const formJsonAddress = (form: HTMLFormElement): Address => {
  const fd = new FormData(form);
  const record: Record<string, string> = {};
  for (const field of ADDRESS_FIELDS) {
    record[field] = (fd.get(field) as string | null) ?? "";
  }
  return addressFromRecord(record);
};

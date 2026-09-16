export type Address = {
  name: string;
  streetAddress: string;
  city: string;
  county: string;
  postCode: string;
};

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

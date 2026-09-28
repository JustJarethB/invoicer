import { z } from "zod/mini";

/**
 * Zod schemas for every data boundary that previously relied on `as` casts,
 * blind `JSON.parse` trust, or unvalidated coercions. Static types are derived
 * from these schemas with `z.output` and re-exported by the domain modules, so
 * the rest of the app keeps its types while the hand-written duplicates die.
 *
 * Imports come from `zod/mini` (the tree-shakable build) so the SPA bundle
 * stays small. The mini build is function-first: `z.safeParse(schema, data)`.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Address, exactly as stored. Fields absent from an older record default to "". */
export const addressSchema = z.object({
  city: z._default(z.string(), ""),
  county: z._default(z.string(), ""),
  name: z._default(z.string(), ""),
  postCode: z._default(z.string(), ""),
  streetAddress: z._default(z.string(), ""),
});

export type Address = z.output<typeof addressSchema>;

/** A logo record: only `url` is meaningful. */
export const logoSchema = z.object({ url: z.string() });

export type Logo = z.output<typeof logoSchema>;

/** An autosaved form blob: field name -> string value. */
export const recordSchema = z.record(z.string(), z.string());

export type FormRecord = z.output<typeof recordSchema>;

/** A persisted localStorage key: a JSON array of string segments. */
export const stringArraySchema = z.array(z.string());

export type StringArray = z.output<typeof stringArraySchema>;

/** Persisted feature flags (e.g. the tutorial marker). */
export const booleanSchema = z.boolean();

// ---------------------------------------------------------------------------
// Invoice domain
// ---------------------------------------------------------------------------

/**
 * Charge-type ids are fixed by the `chargeTypes` table: "0".."3". "-1" is the
 * legacy VAT marker kept from the original LineItem type union.
 */
export const chargeTypeIdSchema = z.enum(["0", "1", "2", "3"]);
export const lineItemTypeSchema = z.union([z.literal("-1"), chargeTypeIdSchema]);

export type ChargeTypeId = z.output<typeof chargeTypeIdSchema>;

const lineItemSchema = z.object({
  date: z.optional(z.string()),
  description: z.optional(z.string()),
  name: z.optional(z.string()),
  qty: z.optional(z.number()),
  type: z.optional(lineItemTypeSchema),
  unit: z.optional(z.string()),
  unitPrice: z.optional(z.number()),
  uuid: z.string(),
  vatRate: z.optional(z.number()),
});

export type LineItem = z.output<typeof lineItemSchema>;

const paymentSchema = z.object({
  amount: z.number(),
  date: z.string(),
  method: z.optional(z.string()),
  reference: z.optional(z.string()),
});

export type Payment = z.output<typeof paymentSchema>;

/**
 * Payment details are written by the payment-details Autosave form, which has
 * no input for `type` (it is set by payment method elsewhere), so every field
 * defaults to an empty string when absent from a stored blob.
 */
export const paymentDetailsSchema = z.object({
  bankName: z._default(z.string(), ""),
  emailAddress: z._default(z.string(), ""),
  info: z._default(z.string(), ""),
  number: z._default(z.string(), ""),
  phoneNumber: z._default(z.string(), ""),
  sortCode: z._default(z.string(), ""),
  terms: z._default(z.string(), ""),
  type: z._default(z.string(), ""),
});

export type PaymentDetails = z.output<typeof paymentDetailsSchema>;

/**
 * `payments` is optional: older persisted records legitimately lack it, and
 * `paymentStatusOf` already defends with `?? []`. This resolves the
 * required-by-type / optional-by-implementation mismatch flagged in the audit.
 */
export const invoiceSchema = z.object({
  date: z.string(),
  from: addressSchema,
  id: z.string(),
  lineItems: z.array(lineItemSchema),
  logo: logoSchema,
  payment: z.optional(paymentDetailsSchema),
  payments: z.optional(z.array(paymentSchema)),
  purchaseOrder: z.string(),
  to: addressSchema,
});

export type Invoice = z.output<typeof invoiceSchema>;

// ---------------------------------------------------------------------------
// Client domain
// ---------------------------------------------------------------------------

const clientSchema = z.object({
  address: addressSchema,
  contactName: z.string(),
  email: z.string(),
  id: z.string(),
  phone: z.string(),
});

export type Client = z.output<typeof clientSchema>;

// ---------------------------------------------------------------------------
// Form boundaries (previously `formJson<T>` cast the DOM's word for it)
// ---------------------------------------------------------------------------

/**
 * The one display-name rule both client forms apply. zod/mini's z.refine
 * returns a $ZodCheck (not a schema), so it attaches via .check() rather
 * than z.pipe: z.pipe(z.string(), z.refine(...)) parses correctly at
 * runtime but fails typecheck. An all-whitespace name is still empty to
 * the user, hence the trim.
 */
const nonEmptyName = z.string().check(z.refine((value) => value.trim().length > 0, "Display name is required"));

/** Client contact fields captured by the clients page form. */
export const clientFormSchema = z.object({
  contactName: nonEmptyName,
  email: z.string(),
  phone: z.string(),
});

export type ClientForm = z.output<typeof clientFormSchema>;

/** SaveClientModal only collects the display name. */
export const clientNameFormSchema = z.object({
  contactName: nonEmptyName,
});

export type ClientNameForm = z.output<typeof clientNameFormSchema>;

// ---------------------------------------------------------------------------
// Parsers — one per data boundary. Helpers here return zod's safeParse
// result so db.ts branches on `success` and tests can inspect `error`
// details; the same shape lets UI boundaries surface a recoverable message.
// Extractors that must throw on invalid input live in their domain modules
// and call z.parse directly, so the parse itself throws.
// ---------------------------------------------------------------------------

/**
 * The earlier editor saved `logo: { url: logo }` although `logo` was already
 * `{ url: string }`. Unwrap only this known legacy shape at the read boundary;
 * all other invoice fields still go through the full schema.
 */
const legacyInvoiceLogoSchema = z.object({ logo: z.object({ url: z.object({ url: z._default(z.string(), "") }) }) });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Convert only complete, finite numeric strings. Invalid text stays invalid. */
const legacyNumber = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return value;
  const number = Number(text);
  return Number.isFinite(number) ? number : value;
};

const legacyOptionalNumber = (value: unknown): unknown => (typeof value === "string" && value.trim() === "" ? undefined : legacyNumber(value));

/** Parse a persisted invoice record, including legacy logo and numeric fields. */
export const parseInvoice = (data: unknown) => {
  if (!isRecord(data)) return z.safeParse(invoiceSchema, data);
  const legacyLogo = z.safeParse(legacyInvoiceLogoSchema, data);
  const normalized = {
    ...data,
    ...(legacyLogo.success ? { logo: legacyLogo.data.logo.url } : {}),
    ...(Array.isArray(data.lineItems)
      ? {
          lineItems: data.lineItems.map((item: unknown) =>
            isRecord(item)
              ? { ...item, qty: legacyOptionalNumber(item.qty), unitPrice: legacyOptionalNumber(item.unitPrice), vatRate: legacyOptionalNumber(item.vatRate) }
              : item
          ),
        }
      : {}),
    ...(Array.isArray(data.payments)
      ? { payments: data.payments.map((payment: unknown) => (isRecord(payment) ? { ...payment, amount: legacyNumber(payment.amount) } : payment)) }
      : {}),
  };
  return z.safeParse(invoiceSchema, normalized);
};

/** Parse a persisted client record. */
export const parseClient = (data: unknown) => z.safeParse(clientSchema, data);

/** Parse a generic string-array blob (localStorage key tuples, the client-key index). */
export const parseStringArray = (data: unknown) => z.safeParse(stringArraySchema, data);

/** Parse an address persisted as a full record (the from-address key). */
export const parseAddress = (data: unknown) => z.safeParse(addressSchema, data);

/** Parse persisted payment details. */
export const parsePaymentDetails = (data: unknown) => z.safeParse(paymentDetailsSchema, data);

/** Parse a persisted logo record. */
export const parseLogo = (data: unknown) => z.safeParse(logoSchema, data);

/** Parse the SaveClientModal name form payload. */
export const parseClientNameForm = (data: unknown) => z.safeParse(clientNameFormSchema, data);

/**
 * The charge-type `<select>` emits raw strings from its options list; this is
 * the runtime check the E1 cast was missing.
 */
export const parseChargeTypeId = (value: string) => z.safeParse(chargeTypeIdSchema, value);

/** Parse a persisted boolean (the showTutorial flag). */
export const parseBoolean = (data: unknown) => z.safeParse(booleanSchema, data);

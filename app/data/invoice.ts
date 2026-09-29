import { z } from "zod/mini";
import { addressSchema } from "./address";
import { paymentDetailsSchema } from "./payment";

// ---------------------------------------------------------------------------
// Legacy money parsing (resolves TODO(legacy-money-strings) at the parse layer)
// ---------------------------------------------------------------------------

/** A usable money value at the parse layer: a finite number already. */
const finiteMoney = z.number().check(z.refine(Number.isFinite, "Money must be a finite number"));

/**
 * Legacy string form of a money quantity: a complete finite numeric string
 * ("150", "150.25") parses to its number. Blank strings belong to
 * `blankableMoneyString`, so an optional field maps blank to absence.
 */
const numericMoneyString = z.pipe(
  z.string().check(z.refine((value) => value.trim() !== "" && Number.isFinite(Number(value.trim())), "Money must be a complete finite numeric string")),
  z.transform((value) => Number(value.trim()))
);

/**
 * Legacy string form of an optional money field. A complete finite numeric
 * string becomes its number; a blank (or whitespace-only) string becomes
 * undefined — absence, not zero — matching the pre-schema shape where an
 * empty optional field was simply not written. Anything else stays invalid.
 */
const blankableMoneyString = z.pipe(
  z.string().check(
    z.refine((value) => {
      const trimmed = value.trim();
      return trimmed === "" || Number.isFinite(Number(trimmed));
    }, "Money must be a finite numeric string or blank")
  ),
  z.transform((value) => {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : Number(trimmed);
  })
);

// ---------------------------------------------------------------------------

/** Charge-type ids are fixed by the `chargeTypes` table below: "0".."3". */
export const chargeTypeIdSchema = z.enum(["0", "1", "2", "3"]);

export type ChargeTypeId = z.output<typeof chargeTypeIdSchema>;

/** A line on the invoice. Money fields (`qty`, `unitPrice`, `vatRate`) are
 * numbers once they leave the form boundary; older persisted records store
 * them as strings, so the schema coerces complete finite numeric strings and
 * treats blank values as absence (never zero). Malformed values stay invalid.
 */
export const lineItemSchema = z.object({
  date: z.optional(z.string()),
  description: z.optional(z.string()),
  name: z.optional(z.string()),
  qty: z.optional(z.union([finiteMoney, blankableMoneyString])),
  type: z.optional(z.union([z.literal("-1"), chargeTypeIdSchema])),
  unit: z.optional(z.string()),
  unitPrice: z.optional(z.union([finiteMoney, blankableMoneyString])),
  uuid: z.string(),
  vatRate: z.optional(z.union([finiteMoney, blankableMoneyString])),
});

export type LineItem = z.output<typeof lineItemSchema>;

/** A payment record. Legacy string `amount`s coerce to numbers here. */
export const paymentSchema = z.object({
  amount: z.union([finiteMoney, numericMoneyString]),
  date: z.string(),
  method: z.optional(z.string()),
  reference: z.optional(z.string()),
});

export type Payment = z.output<typeof paymentSchema>;

/** A logo record: only `url` is meaningful. Legacy records may miss `url`. */
export const logoSchema = z.object({ url: z._default(z.string(), "") });

export type Logo = z.output<typeof logoSchema>;

/** Schema for a persisted Invoice record (the `invoice` domain). */
export const invoiceSchema = z.object({
  date: z.string(),
  from: addressSchema,
  id: z.string(),
  lineItems: z.array(lineItemSchema),
  logo: logoSchema,
  payment: z.optional(paymentDetailsSchema),
  // Older persisted records legitimately lack `payments` (and some store an
  // explicit null — the old `?? []` tolerated both). The pipe normalizes
  // undefined AND null to [], so the inferred type is strictly Payment[]
  // while tolerating both legacy shapes at the parse layer.
  payments: z._default(
    z.pipe(
      z.union([z.array(paymentSchema), z.null()]),
      z.transform((v) => v ?? [])
    ),
    []
  ),
  purchaseOrder: z.string(),
  to: addressSchema,
});

export type Invoice = z.output<typeof invoiceSchema>;

export type ChargeType = {
  id: ChargeTypeId;
  label: string;
  calculation: (qty: number, unitPrice: number) => number;
  disabledFields?: (keyof LineItem)[];
};

export const chargeTypes = [
  {
    id: "0",
    label: "Service",
    calculation: (qty, unitPrice) => qty * unitPrice,
  },
  {
    id: "1",
    label: "Rental",
    calculation: (qty, unitPrice) => qty * unitPrice,
  },
  {
    id: "2",
    label: "Expense",
    calculation: (qty, unitPrice) => qty * unitPrice,
  },
  {
    id: "3",
    label: "Discount",
    calculation: (_qty, unitPrice) => -unitPrice,
    disabledFields: ["qty", "unit"] as (keyof LineItem)[],
  },
] satisfies ChargeType[];

/** Price of a single line. Blank or untyped lines contribute nothing. */
export const linePrice = ({ qty, type, unitPrice }: Pick<LineItem, "qty" | "unitPrice" | "type">) =>
  chargeTypes.find((chargeType) => chargeType.id === type)?.calculation(qty ?? 0, unitPrice ?? 0) ?? 0;

/** Sum of all line prices on an invoice. */
export const invoiceTotal = (invoice: Pick<Invoice, "lineItems">) => invoice.lineItems.map(linePrice).reduce((p, c) => p + c, 0);

export type PaymentStatus = "overpaid" | "paid" | "partial" | "unpaid";

export type PaymentSummary = {
  totalDue: number;
  totalPaid: number;
  due: number;
  paymentStatus: PaymentStatus;
};

/** Payment arithmetic for one invoice. `payments` may be absent on older records. */
export const paymentStatusOf = (invoice: Pick<Invoice, "lineItems" | "payments">): PaymentSummary => {
  const totalDue = invoiceTotal(invoice);
  const totalPaid = (invoice.payments ?? []).map((p) => p.amount).reduce((p, c) => p + c, 0);
  const paymentStatus: PaymentStatus =
    totalPaid > totalDue ? "overpaid" : totalPaid > 0 && totalPaid < totalDue ? "partial" : totalPaid === totalDue ? "paid" : "unpaid";
  return { totalDue, totalPaid, paymentStatus, due: totalDue - totalPaid };
};

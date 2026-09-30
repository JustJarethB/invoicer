import { z } from "zod/mini";
import { AddressSchema } from "./address";
import { PaymentDetailsSchema } from "./payment";

const FiniteMoney = z.number().check(z.refine(Number.isFinite, "Money must be a finite number"));

const NumericMoneyString = z.pipe(
  z.string().check(z.refine((value) => value.trim() !== "" && Number.isFinite(Number(value.trim())), "Money must be a complete finite numeric string")),
  z.transform((value) => Number(value.trim()))
);

/** Blank (or whitespace-only) becomes undefined: absence, never zero. */
const BlankableMoneyString = z.pipe(
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

export const ChargeTypeIdSchema = z.enum(["0", "1", "2", "3"]);

export type ChargeTypeId = z.infer<typeof ChargeTypeIdSchema>;

export const LineItemSchema = z.object({
  date: z.optional(z.string()),
  description: z.optional(z.string()),
  name: z.optional(z.string()),
  qty: z.optional(z.union([FiniteMoney, BlankableMoneyString])),
  type: z.optional(z.union([z.literal("-1"), ChargeTypeIdSchema])),
  unit: z.optional(z.string()),
  unitPrice: z.optional(z.union([FiniteMoney, BlankableMoneyString])),
  uuid: z.string(),
  vatRate: z.optional(z.union([FiniteMoney, BlankableMoneyString])),
});

export type LineItem = z.infer<typeof LineItemSchema>;

export const PaymentSchema = z.object({
  amount: z.union([FiniteMoney, NumericMoneyString]),
  date: z.string(),
  method: z.optional(z.string()),
  reference: z.optional(z.string()),
});

export type Payment = z.infer<typeof PaymentSchema>;

const LogoUrlObject = z.pipe(
  z.object({ url: z._default(z.string(), "") }),
  z.transform((blob) => blob.url)
);
/** Legacy blobs (url wrapped or double-wrapped in an object) unwrap to a string; anything else stays invalid. */
const LegacyLogoUrl = z.union([
  z.string(),
  z.pipe(
    z.object({ url: z.optional(z.string()) }),
    z.transform((blob) => blob.url ?? "")
  ),
  z.pipe(
    z.object({ url: LogoUrlObject }),
    z.transform((blob) => blob.url)
  ),
]);

export const LogoSchema = z.object({ url: z._default(LegacyLogoUrl, "") });

export type Logo = z.infer<typeof LogoSchema>;

export const InvoiceSchema = z.object({
  date: z.string(),
  from: AddressSchema,
  id: z.string(),
  lineItems: z.array(LineItemSchema),
  logo: LogoSchema,
  payment: z.optional(PaymentDetailsSchema),
  // Legacy records may lack `payments` or store an explicit null; both normalize to [].
  payments: z._default(
    z.pipe(
      z.union([z.array(PaymentSchema), z.null()]),
      z.transform((v) => v ?? [])
    ),
    []
  ),
  purchaseOrder: z.string(),
  to: AddressSchema,
});

export type Invoice = z.infer<typeof InvoiceSchema>;

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

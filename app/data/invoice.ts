import type { Address, ChargeTypeId, Invoice, LineItem, Payment } from "./schemas";

/**
 * Charge types describe how a line contributes to the invoice total.
 * Service and Rental bill per unit; Expense is a reimbursable cost; Discount
 * subtracts a flat amount once (quantity is ignored).
 */
export type ChargeType = {
  id: ChargeTypeId;
  label: string;
  calculation: (qty: number, unitPrice: number) => number;
  disabledFields?: (keyof LineItem)[];
};

export const chargeTypes = [
  {
    calculation: (qty, unitPrice) => qty * unitPrice,
    id: "0",
    label: "Service",
  },
  {
    calculation: (qty, unitPrice) => qty * unitPrice,
    id: "1",
    label: "Rental",
  },
  {
    calculation: (qty, unitPrice) => qty * unitPrice,
    id: "2",
    label: "Expense",
  },
  {
    calculation: (_qty, unitPrice) => -unitPrice,
    disabledFields: ["qty", "unit"] as (keyof LineItem)[],
    id: "3",
    label: "Discount",
  },
] satisfies ChargeType[];

/**
 * LineItem, Payment and Invoice are derived from the zod schemas in
 * `~/data/schemas` (see the migration notes there); they are re-exported here
 * so the rest of the app can keep importing them from this module.
 */
export type { Invoice, LineItem, Payment };

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
  return { due: totalDue - totalPaid, paymentStatus, totalDue, totalPaid };
};

export type { Address };

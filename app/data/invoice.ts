import type { Address } from "./address";
import type { PaymentDetails } from "./payment";

/**
 * Charge types describe how a line contributes to the invoice total.
 * Service and Rental bill per unit; Expense is a reimbursable cost; Discount
 * subtracts a flat amount once (quantity is ignored).
 */
export type ChargeType = {
  id: "0" | "1" | "2" | "3";
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

/**
 * A line on the invoice. Money fields are numbers once they leave the form
 * boundary; an empty field is represented by absence of the property.
 */
export type LineItem = {
  uuid: string;
  date?: string;
  name?: string;
  description?: string;
  unit?: string;
  qty?: number;
  unitPrice?: number;
  vatRate?: number;
  type?: "-1" | ChargeType["id"];
};

export type Payment = {
  amount: number;
  date: string;
  method?: string;
  reference?: string;
};

export type Invoice = {
  id: string;
  date: string;
  purchaseOrder: string;
  logo: { url: string };
  from: Address;
  to: Address;
  lineItems: LineItem[];
  payment?: PaymentDetails;
  payments: Payment[];
};

/** Price of a single line. Blank or untyped lines contribute nothing. */
export const linePrice = ({ qty, unitPrice, type }: Pick<LineItem, "qty" | "unitPrice" | "type">) =>
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

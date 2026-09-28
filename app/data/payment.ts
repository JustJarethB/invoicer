import { type FormRecord, type PaymentDetails, parsePaymentDetails } from "./schemas";

/**
 * PaymentDetails is derived from the zod schema in `~/data/schemas` and
 * re-exported here so the rest of the app keeps importing it from this module.
 */
export type { PaymentDetails };

/**
 * Build PaymentDetails from a form record. The schema owns the empty-string
 * defaults, so this is a plain parse. It always succeeds for formJson output
 * (every field is a defaulted string) and throws on schema drift, mirroring
 * clientFromForm.
 */
export const paymentDetailsFromRecord = (record: FormRecord): PaymentDetails => {
  const parsed = parsePaymentDetails(record);
  if (!parsed.success) throw new Error("Payment details form does not match its schema");
  return parsed.data;
};

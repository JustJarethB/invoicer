import type { PaymentDetails } from "./schemas";
import type { FormRecord } from "./schemas";

/**
 * PaymentDetails is derived from the zod schema in `~/data/schemas` and
 * re-exported here so the rest of the app keeps importing it from this module.
 */
export type { PaymentDetails };

/** Build PaymentDetails from a form record, defaulting absent fields to empty. */
export const paymentDetailsFromRecord = (record: FormRecord): PaymentDetails => ({
  bankName: record.bankName ?? "",
  emailAddress: record.emailAddress ?? "",
  info: record.info ?? "",
  number: record.number ?? "",
  phoneNumber: record.phoneNumber ?? "",
  sortCode: record.sortCode ?? "",
  terms: record.terms ?? "",
  type: record.type ?? "",
});

import { z } from "zod/mini";

// TODO: terms/email/phone/info are universal
// rest are dependent on the type of payment
export const PaymentDetailsSchema = z.object({
  bankName: z._default(z.string(), ""),
  emailAddress: z._default(z.string(), ""),
  info: z._default(z.string(), ""),
  number: z._default(z.string(), ""),
  phoneNumber: z._default(z.string(), ""),
  sortCode: z._default(z.string(), ""),
  terms: z._default(z.string(), ""),
  type: z._default(z.string(), ""),
});

export type PaymentDetails = z.infer<typeof PaymentDetailsSchema>;

/** Build PaymentDetails from a form record, defaulting absent fields to empty. */
export const paymentDetailsFromRecord = (record: Record<string, string>): PaymentDetails => ({
  terms: record.terms ?? "",
  type: record.type ?? "",
  bankName: record.bankName ?? "",
  sortCode: record.sortCode ?? "",
  number: record.number ?? "",
  emailAddress: record.emailAddress ?? "",
  phoneNumber: record.phoneNumber ?? "",
  info: record.info ?? "",
});

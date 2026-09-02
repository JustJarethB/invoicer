// TODO: terms/email/phone/info are universal
// rest are dependent on the type of payment
export type PaymentDetails = {
  terms: string;
  type: string;
  bankName: string;
  sortCode: string;
  number: string;
  emailAddress: string;
  phoneNumber: string;
  info: string;
};

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

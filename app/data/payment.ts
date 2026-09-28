import { z } from "zod/mini";
import { type FormRecord, type PaymentDetails, paymentDetailsSchema } from "./schemas";

/**
 * PaymentDetails is derived from the zod schema in `~/data/schemas` and
 * re-exported here so the rest of the app keeps importing it from this module.
 */
export type { PaymentDetails };

/**
 * Build PaymentDetails from a form record. The schema owns the empty-string
 * defaults, so this is a plain parse. It always succeeds for formJson output
 * (every field is a defaulted string); on schema drift the parse itself
 * throws, mirroring clientFromForm.
 */
export const paymentDetailsFromRecord = (record: FormRecord): PaymentDetails => z.parse(paymentDetailsSchema, record);

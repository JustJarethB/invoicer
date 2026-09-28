import { describe, expect, it } from "vitest";
import { paymentDetailsFromRecord } from "./payment";

describe("paymentDetailsFromRecord", () => {
  it("defaults every field of an empty record to an empty string", () => {
    // The payment-details Autosave form renders a subset of PaymentDetails; a
    // record from it must always parse (the schema defaults every field), so
    // the drift-throw in paymentDetailsFromRecord is unreachable here.
    expect(paymentDetailsFromRecord({})).toEqual({
      bankName: "",
      emailAddress: "",
      info: "",
      number: "",
      phoneNumber: "",
      sortCode: "",
      terms: "",
      type: "",
    });
  });

  it("keeps the form's values and defaults the fields the form does not render", () => {
    expect(paymentDetailsFromRecord({ bankName: "Acme Bank", terms: "30 days" })).toEqual({
      bankName: "Acme Bank",
      emailAddress: "",
      info: "",
      number: "",
      phoneNumber: "",
      sortCode: "",
      terms: "30 days",
      type: "",
    });
  });
});

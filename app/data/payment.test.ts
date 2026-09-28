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

  it("throws when a record fails its schema, so drift is loud rather than silent", () => {
    // paymentDetailsSchema defaults every field, so any well-formed string
    // record parses. Only schema drift (a field type changing) can reach the
    // throw; this pins the fail-loud contract. The drifted record arrives as
    // raw JSON (as storage would deliver it), so the test needs no cast.
    const drifted = JSON.parse('{"bankName":1}');
    expect(() => paymentDetailsFromRecord(drifted)).toThrow("Payment details form does not match its schema");
  });
});

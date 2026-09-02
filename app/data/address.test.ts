import { describe, expect, it } from "vitest";
import { emptyAddress, type Address } from "./address";

describe("Address", () => {
  it("stores all address fields", () => {
    // An invoice needs a complete from/to address for legal and postal purposes.
    const address: Address = {
      name: "Acme Ltd",
      streetAddress: "1 Example Street",
      city: "London",
      county: "Greater London",
      postCode: "SW1A 1AA",
    };
    expect(address.name).toBe("Acme Ltd");
    expect(address.streetAddress).toBe("1 Example Street");
    expect(address.city).toBe("London");
    expect(address.county).toBe("Greater London");
    expect(address.postCode).toBe("SW1A 1AA");
  });

  it("provides an empty address via emptyAddress()", () => {
    // Partial addresses are valid while the user is still typing.
    expect(emptyAddress()).toEqual({ name: "", streetAddress: "", city: "", county: "", postCode: "" });
  });
});

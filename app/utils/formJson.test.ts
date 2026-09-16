import { describe, expect, it, vi } from "vitest";
import { formJson } from "./formJson";

function buildForm(entries: Record<string, string | Blob>): HTMLFormElement {
  const form = document.createElement("form");
  for (const [name, value] of Object.entries(entries)) {
    const input = document.createElement("input");
    input.name = name;
    if (typeof value === "string") {
      input.value = value;
    } else {
      // File inputs cannot have their value set programmatically, so we attach
      // a hidden file input via Object.defineProperty for the test only.
      input.type = "file";
      Object.defineProperty(input, "files", {
        value: [value],
        writable: false,
      });
    }
    form.appendChild(input);
  }
  return form;
}

describe("formJson", () => {
  it("serialises plain text fields into a record", async () => {
    const form = buildForm({ email: "hello@acme.test", name: "Acme" });
    const data = await formJson(form);

    expect(data).toEqual({ email: "hello@acme.test", name: "Acme" });
  });

  it("returns empty strings for fields the user left blank", async () => {
    const form = buildForm({ empty: "", filled: "value" });
    const data = await formJson(form);

    expect(data).toEqual({ empty: "", filled: "value" });
  });

  it("converts a Blob field to a base64 data URL", async () => {
    const content = "hello";
    const blob = new Blob([content], { type: "text/plain" });
    const form = buildForm({ attachment: blob, note: "note text" });

    // jsdom's FileReader does not actually read Blob contents, so we provide a
    // minimal stub that returns a deterministic data URL once onloadend fires.
    const originalFileReader = globalThis.FileReader;
    vi.stubGlobal(
      "FileReader",
      vi.fn(() => ({
        readAsDataURL: vi.fn(function (this: { onloadend?: () => void }) {
          setTimeout(() => this.onloadend?.(), 0);
        }),
        result: "data:text/plain;base64,aGVsbG8=",
      }))
    );

    try {
      const data = await formJson(form);
      expect(data.note).toBe("note text");
      expect(data.attachment).toBe("data:text/plain;base64,aGVsbG8=");
    } finally {
      vi.stubGlobal("FileReader", originalFileReader);
    }
  });

  it("keeps string values unchanged when no processor matches", async () => {
    // The implementation has no processors beyond 'base64', so arbitrary strings
    // should pass through untouched.
    const form = buildForm({ unknown: "plain value" });
    const data = await formJson(form);

    expect(data.unknown).toBe("plain value");
  });

  it("rejects non-string, non-Blob form values instead of coercing", async () => {
    // FormDataEntryValue is `string | File`; anything else cannot occur in a
    // real form, and the old code silently cast it to string.
    const form = buildForm({ bogus: "value" });
    vi.stubGlobal(
      "FormData",
      vi.fn(function (this: unknown) {
        const fakeEntries: [string, unknown][] = [["bogus", 42]];
        return {
          [Symbol.iterator]: () => fakeEntries[Symbol.iterator](),
        };
      })
    );

    try {
      await expect(formJson(form)).rejects.toThrow("Unexpected form value type: number");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("feeds a schema parser: a valid record parses, an invalid one fails", async () => {
    const { parseClientForm } = await import("~/data/schemas");
    const good = buildForm({ contactName: "Acme", email: "hello@acme.test", phone: "123" });
    const parsedGood = parseClientForm(await formJson(good));
    expect(parsedGood.success).toBe(true);

    // A form missing the email field must now fail validation instead of
    // producing `email: undefined` typed as string.
    const bad = buildForm({ contactName: "Acme" });
    const parsedBad = parseClientForm(await formJson(bad));
    expect(parsedBad.success).toBe(false);
  });
});

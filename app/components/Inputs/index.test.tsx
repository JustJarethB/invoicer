import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextInput } from "~/components/Inputs";

describe("TextInput uncontrolled defaultValue sync", () => {
  it("shows a changed defaultValue when the uncontrolled field was never typed into", () => {
    const view = render(<TextInput name="to-name" defaultValue="Acme Ltd" />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(field).toHaveValue("Acme Ltd");

    // Parent state reset the address back to empty.
    view.rerender(<TextInput name="to-name" defaultValue="" />);
    expect(field).toHaveValue("");
  });

  it("clears a dirty uncontrolled field when the parent resets defaultValue after focus moved away", async () => {
    // Regression for PR #61 review thread PRRT_kwDOO_RAsM6n-H51 (root 4156128757):
    // the To panel is uncontrolled, so a state-driven clear (missing client
    // selected) never reached the DOM for fields the user had typed into —
    // the dirty value kept the stale text visible and in the form record.
    const view = render(<TextInput name="to-name" defaultValue="Acme Ltd" />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.type(field, " and more");
    expect(field).toHaveValue("Acme Ltd and more");

    // Blur the way a selection interaction does (focus moves off the field).
    await userEvent.tab();
    view.rerender(<TextInput name="to-name" defaultValue="" />);
    expect(field).toHaveValue("");
  });

  it("never rewrites a focused dirty field; a skipped reset applies only when defaultValue changes again after blur", async () => {
    const view = render(<TextInput name="to-name" defaultValue="Alpha" />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.type(field, "X"); // dirty: "AlphaX", focus still on the field
    expect(field).toHaveValue("AlphaX");

    // A lagged parent echo (form read resolving after the keystroke) carries
    // the pre-keystroke text; it must not rewrite what the user just typed
    // while they are still in the field.
    view.rerender(<TextInput name="to-name" defaultValue="Alph" />);
    expect(field).toHaveValue("AlphaX");

    // Blur alone applies nothing: it is not an effect trigger, so the skipped
    // "Alph" reset is discarded and the user's text keeps the field.
    await userEvent.tab();
    expect(field).toHaveValue("AlphaX");

    // A further parent change (the next echo / selection) applies once the
    // field is unfocused: the sync runs for the new defaultValue.
    view.rerender(<TextInput name="to-name" defaultValue="Beta" />);
    expect(field).toHaveValue("Beta");
  });

  it("never writes an input that has no defaultValue", async () => {
    const view = render(<TextInput name="free-text" />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.type(field, "typed text");
    expect(field).toHaveValue("typed text");

    // Without a string defaultValue there is no sync target: re-renders
    // driven by unrelated parent state never rewrite the field.
    view.rerender(<TextInput name="free-text" />);
    expect(field).toHaveValue("typed text");
  });

  it("keeps controlled value updates driving the DOM", () => {
    // Controlled usage is the value-prop path; the defaultValue sync is
    // uncontrolled-only (this codebase never mixes value and defaultValue),
    // so these assertions pin that the touched effect did not break it.
    const view = render(<TextInput name="invoice-ref" value="INV-1" onChange={() => {}} />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(field).toHaveValue("INV-1");

    view.rerender(<TextInput name="invoice-ref" value="INV-2" onChange={() => {}} />);
    expect(field).toHaveValue("INV-2");
  });
});

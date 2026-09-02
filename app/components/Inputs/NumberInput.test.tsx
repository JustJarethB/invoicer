import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberInput } from "~/components/Inputs";

describe("NumberInput", () => {
  it("emits a parsed number when the user types a value", async () => {
    // Line items and payments store numbers; the input is the parse boundary.
    const onChange = vi.fn();
    render(<NumberInput name="qty" onChange={onChange} />);
    const field = screen.getByRole("textbox");
    await userEvent.type(field, "150");
    expect(onChange).toHaveBeenLastCalledWith(150);
  });

  it("renders an initial numeric value as its string form", () => {
    // Display: an incoming number is shown to the user as text on mount.
    render(<NumberInput name="qty" value={42} onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("42");
  });

  it("emits undefined for blank input so the field stays empty", async () => {
    // Clearing the field should clear the value, not store 0 or NaN.
    const onChange = vi.fn();
    render(<NumberInput name="qty" value={5} onChange={onChange} />);
    const field = screen.getByRole("textbox");
    await userEvent.clear(field);
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("keeps a trailing decimal point visible while typing", async () => {
    // Regression: committing to the parent on every keystroke fed the parsed
    // number back as the display value, so "12." re-rendered as "12" and the
    // point disappeared before the user could type the decimals.
    render(<NumberInput name="unitPrice" value={12} onChange={() => {}} />);
    const field = screen.getByRole("textbox");
    await userEvent.type(field, ".5");
    expect(field).toHaveValue("12.5");
  });

  it("snaps the value to canonical form on blur", async () => {
    // On blur the field commits what it shows: "12." becomes "12", extra
    // decimals are truncated to two, leading zeros are stripped.
    render(<NumberInput name="unitPrice" value={12} onChange={() => {}} />);
    const field = screen.getByRole("textbox");
    await userEvent.type(field, ".");
    expect(field).toHaveValue("12.");
    await userEvent.tab();
    expect(field).toHaveValue("12");
  });

  it("truncates to two decimal places on blur", async () => {
    render(<NumberInput name="unitPrice" onChange={() => {}} />);
    const field = screen.getByRole("textbox");
    await userEvent.type(field, "100.999");
    await userEvent.tab();
    expect(field).toHaveValue("100.99");
  });

  it("emits the final parsed value on blur", async () => {
    const onChange = vi.fn();
    render(<NumberInput name="unitPrice" onChange={onChange} />);
    const field = screen.getByRole("textbox");
    await userEvent.type(field, "12.");
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(12);
  });
});

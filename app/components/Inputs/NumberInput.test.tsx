import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberInput } from "~/components/Inputs";

describe("NumberInput", () => {
  it("emits a parsed number when the user types a value", async () => {
    // Line items and payments store numbers; the input is the parse boundary.
    const onChange = vi.fn();
    render(<NumberInput name="qty" value={undefined} onChange={onChange} />);
    const field = screen.getByRole("textbox");
    await userEvent.type(field, "150");
    expect(onChange).toHaveBeenLastCalledWith(150);
  });

  it("renders a numeric value as its string form", () => {
    // Display: incoming number state is shown to the user as text.
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
});

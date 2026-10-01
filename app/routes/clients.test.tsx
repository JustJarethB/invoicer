import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Clients from "./clients";

afterEach(() => cleanup());

describe("clients route", () => {
  it("shows a recoverable error when the contact name contains only whitespace", async () => {
    render(<Clients />);

    const contactName = screen.getByPlaceholderText("Contact Name");
    fireEvent.change(contactName, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Display name is required");
    expect(contactName).toHaveValue("   ");
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
  });
});

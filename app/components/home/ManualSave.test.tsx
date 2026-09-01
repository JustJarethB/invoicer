import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManualSave } from "./ManualSave";
import { SaveClientModal } from "./SaveClientModal";
import { TextInput } from "~/components/Inputs";
import { getClients } from "~/data/client";

const saveAddressAsClient = (record: Record<string, string>, close: () => void) => <SaveClientModal record={record} onClose={close} />;

describe("ManualSave", () => {
  it("opens the caller's confirmation on save-click and persists via it", async () => {
    // Regression: the save icon must reach the caller's onSave, and the modal's
    // own Save must write the client to localStorage.
    render(
      <ManualSave onSave={saveAddressAsClient}>
        <TextInput name="name" value="Acme Ltd" onChange={() => {}} />
        <TextInput name="streetAddress" value="1 Way" onChange={() => {}} />
      </ManualSave>
    );

    // Click the manual-save icon (the only element with the save tooltip's icon role).
    const saveIcon = document.querySelector("svg.cursor-pointer");
    expect(saveIcon).toBeInTheDocument();
    await userEvent.click(saveIcon as Element);

    // The modal opens with the address prefilled from the captured record
    // (both the outer form and the prefilled AddressPanel carry these values).
    expect(await screen.findByText("Save Client")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Acme Ltd").length).toBeGreaterThan(1);
    expect(screen.getAllByDisplayValue("1 Way").length).toBeGreaterThan(1);

    // Add the extra field a Client needs, then save.
    await userEvent.type(screen.getByPlaceholderText("Display Name"), "Acme");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    // The client is persisted (this is the user-facing guarantee; modal-close
    // timing is incidental and covered by the component's own close prop).
    await waitFor(async () => {
      const clients = await getClients();
      expect(clients).toHaveLength(1);
      expect(clients[0].contactName).toBe("Acme");
      expect(clients[0].address.name).toBe("Acme Ltd");
    });
  });

  it("does nothing when no onSave is provided", async () => {
    // onSave is optional — ManualSave is reusable for forms that don't confirm.
    render(
      <ManualSave>
        <TextInput name="name" value="x" onChange={() => {}} />
      </ManualSave>
    );
    const saveIcon = document.querySelector("svg.cursor-pointer");
    await userEvent.click(saveIcon as Element);
    // No modal appears.
    expect(screen.queryByText("Save Client")).not.toBeInTheDocument();
  });
});

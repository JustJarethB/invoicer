import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { Toaster } from "~/components/Toaster";
import { AddressPanel } from "~/components/home/AddressPanel";
import { Controls } from "~/components/home/Controls";
import { ManualSave } from "~/components/home/ManualSave";
import { type Address, addressFromRecord, emptyAddress } from "~/data/address";
import { type Client } from "~/data/client";
import { createClientAddressLoader } from "~/routes/invoice";
import { makeClient } from "~/data/testFixtures";
import { formJson } from "~/utils/formJson";
import { eventBus } from "~/utils/events";

eventBus.subscribe(() => {})(); // drain any retained replay events before the suite starts

const clients: Client[] = [makeClient({ id: "client-7", contactName: "Alpha", address: { ...emptyAddress(), name: "Alpha House", city: "Springfield" } })];

type ClientAddressLoader = (clientId: string) => void;

/**
 * The route slice under test, wired exactly as app/routes/invoice.tsx does:
 * the To panel lives in its own ManualSave form whose async form-read echoes
 * back into the same `to` state the loader clears, and warnings surface
 * through the real Toaster. The loader is handed out through `onLoader` so
 * tests drive the missing-id direction through the exact setter the panel
 * reads — the dropdown cannot offer a missing id (options come from the live
 * clients list), so a direct loader call is the missing-id flow's shape.
 */
function Harness({
  clients: available,
  onEcho,
  onLoader,
}: {
  clients: Client[];
  onEcho?: (record: Record<string, string>) => void;
  onLoader: (loader: ClientAddressLoader) => void;
}) {
  const [to, setTo] = useState<Address>(emptyAddress());
  const loader = createClientAddressLoader(available, setTo);
  useEffect(() => {
    onLoader(loader);
  }, [loader, onLoader]);
  return (
    <>
      <Controls clients={available} loadClientAddress={loader} saveInvoice={() => {}} />
      <ManualSave
        onChange={(record) => {
          onEcho?.(record);
          setTo(addressFromRecord(record));
        }}
      >
        <AddressPanel title="To:" address={to} />
      </ManualSave>
      <Toaster />
    </>
  );
}

const toFields = () => ({
  name: screen.getByPlaceholderText("Name") as HTMLTextAreaElement,
  streetAddress: screen.getByPlaceholderText("Street Address") as HTMLTextAreaElement,
  city: screen.getByPlaceholderText("City/Town") as HTMLTextAreaElement,
  county: screen.getByPlaceholderText("County") as HTMLTextAreaElement,
  postCode: screen.getByPlaceholderText("Postcode") as HTMLTextAreaElement,
});

// Each keystroke fires one async ManualSave form read (formJson resolves in a
// microtask), so waiting on the echo count proves the round-trip fully settled
// before the next interaction — no lagged echo can race a later clear.
const typeAndAwaitEchoes = async (echoes: Record<string, string>[], text: string) => {
  await userEvent.type(screen.getByPlaceholderText("Name"), text);
  await waitFor(() => {
    expect(echoes.length).toBe(text.length);
  });
};

const selectClient = async (contactName: string) => {
  await userEvent.click(screen.getByRole("button", { name: "Clients" }));
  await userEvent.click(screen.getByRole("button", { name: contactName }));
};

describe("form-level To clear (PR #61 thread PRRT_kwDOO_RAsM6n-H51, root 4156128757)", () => {
  afterEach(() => {
    cleanup();
    eventBus.subscribe(() => {})(); // drain retained replay events so later tests stay clean
  });

  it("clears prior typed/populated To values visibly, reads the form empty, and shows exactly one warning toast when the selected client cannot be found", async () => {
    let captured: ClientAddressLoader | null = null;
    const capture = (loader: ClientAddressLoader) => {
      captured = loader;
    };
    const echoes: Record<string, string>[] = [];
    render(
      <Harness
        clients={clients}
        onEcho={(record) => {
          echoes.push(record);
        }}
        onLoader={capture}
      />
    );

    // Prior values: populated through the real dropdown, then extended by typing.
    await selectClient("Alpha");
    await waitFor(() => expect(toFields().name).toHaveValue("Alpha House"));
    expect(toFields().city).toHaveValue("Springfield");
    await typeAndAwaitEchoes(echoes, " Ltd");
    expect(toFields().name).toHaveValue("Alpha House Ltd");

    // Selecting a client moves focus off the To field into the dropdown
    // (clicking the Clients button reproduces that blur deterministically),
    // then a selection whose client cannot be found fires the loader.
    await userEvent.click(screen.getByRole("button", { name: "Clients" }));
    act(() => {
      const loader = captured;
      if (!loader) throw new Error("loader was not captured from the harness render");
      loader("gone-client");
    });

    // Visible To fields are empty.
    for (const field of Object.values(toFields())) {
      expect(field).toHaveValue("");
    }

    // The live form — what ManualSave hands to save/submission — reads empty.
    const form = screen.getByPlaceholderText("Name").closest("form");
    if (!form) throw new Error("ManualSave form not found");
    const record = await formJson<Record<string, string>>(form);
    expect(record.name).toBe("");
    expect(record.streetAddress).toBe("");
    expect(record.city).toBe("");
    expect(record.county).toBe("");
    expect(record.postCode).toBe("");

    // Exactly one warning toast, through the real Toaster.
    const toasts = screen.getAllByTestId("toast-item");
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toHaveAttribute("data-severity", "warning");
    expect(screen.getByText("Selected client could not be found")).toBeInTheDocument();
  });

  it("populates the visible To fields through the real dropdown and keeps manual edits afterwards", async () => {
    const capture = () => {};
    const echoes: Record<string, string>[] = [];
    render(
      <Harness
        clients={clients}
        onEcho={(record) => {
          echoes.push(record);
        }}
        onLoader={capture}
      />
    );

    await selectClient("Alpha");
    await waitFor(() => {
      expect(toFields().name).toHaveValue("Alpha House");
      expect(toFields().city).toHaveValue("Springfield");
    });

    // Manual editing stays allowed: typing appends and survives the async
    // form-read echo without being clobbered back to the populated value.
    await typeAndAwaitEchoes(echoes, " Ltd");
    expect(toFields().name).toHaveValue("Alpha House Ltd");
  });

  it("applies a found client's address over prior typed To values when a selection is made", async () => {
    const capture = () => {};
    const echoes: Record<string, string>[] = [];
    render(
      <Harness
        clients={clients}
        onEcho={(record) => {
          echoes.push(record);
        }}
        onLoader={capture}
      />
    );

    // Populate through the dropdown, then extend two fields by typing (dirty
    // fields; each keystroke echo writes the typed text back into the same
    // state the next selection overwrites).
    await selectClient("Alpha");
    await waitFor(() => expect(toFields().name).toHaveValue("Alpha House"));
    await typeAndAwaitEchoes(echoes, " Ltd");
    expect(toFields().name).toHaveValue("Alpha House Ltd");
    const echoesBeforeStreet = echoes.length;
    await userEvent.type(screen.getByPlaceholderText("Street Address"), " Unit 5");
    await waitFor(() => expect(echoes.length).toBe(echoesBeforeStreet + " Unit 5".length));
    expect(toFields().streetAddress).toHaveValue(" Unit 5");

    // Selecting again re-runs the loader for the found client. Clicking the
    // dropdown moves focus off the To fields, so the changed defaultValues
    // (typed text -> client address) become visible; the form must not stay
    // stuck on manually typed values.
    await selectClient("Alpha");
    await waitFor(() => {
      expect(toFields().name).toHaveValue("Alpha House");
      expect(toFields().city).toHaveValue("Springfield");
    });
    expect(toFields().streetAddress).toHaveValue("");
  });
});

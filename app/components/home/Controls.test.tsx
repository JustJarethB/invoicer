import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Controls } from "./Controls";
import { InvoiceEditorProvider, useInvoiceEditor } from "./InvoiceEditorProvider";
import { LineItemProvider } from "~/components/home/LineItems/LineItemProvider";
import { emptyAddress } from "~/data/address";
import { type Client, NULL_CLIENT } from "~/data/client";
import { paymentDetailsFromRecord } from "~/data/payment";
import { type AppEvent, type AppEventType, eventBus } from "~/utils/events";

const clients: Client[] = [
  { ...NULL_CLIENT, id: "client-7", contactName: "Alpha", address: { ...NULL_CLIENT.address, name: "Alpha House" } },
  { ...NULL_CLIENT, id: "client-3", contactName: "Beta", address: { ...NULL_CLIENT.address, name: "Beta House" } },
  { ...NULL_CLIENT, id: "client-5", contactName: "Gamma", address: { ...NULL_CLIENT.address, name: "Gamma House" } },
];

const received: AppEvent[] = [];
let unsubscribe: () => void = () => {};

const listenForEvents = () => {
  unsubscribe();
  received.length = 0;
  unsubscribe = eventBus.subscribe((event) => received.push(event));
  received.length = 0; // drain any replayed history
};

const eventsOfType = (type: AppEventType, action?: string) =>
  received.filter((event) => event.type === type && (action === undefined || event.context?.action === action));

const ToNameProbe = () => {
  const editor = useInvoiceEditor();
  return <p data-testid="to-address-name">{editor.to.name || "(empty)"}</p>;
};

const renderControls = (loaded: Client[]) => {
  render(
    <LineItemProvider>
      <InvoiceEditorProvider clients={loaded} from={emptyAddress()} payment={paymentDetailsFromRecord({})} logo={null}>
        <Controls clients={loaded} />
        <ToNameProbe />
      </InvoiceEditorProvider>
    </LineItemProvider>
  );
};

afterEach(() => {
  unsubscribe();
  unsubscribe = () => {};
  eventBus.subscribe(() => {})(); // drain any replayed events so a later test's subscribers stay clean
  cleanup();
});

describe("Controls client selection", () => {
  it("loads the chosen client's address into the To panel, keyed by id not position", async () => {
    renderControls(clients);
    await userEvent.click(screen.getByRole("button", { name: /Clients/ }));
    await userEvent.click(screen.getByRole("button", { name: "Beta" }));
    await waitFor(() => expect(screen.getByTestId("to-address-name")).toHaveTextContent("Beta House"));
  });

  it("saves the invoice through the provider when Save is clicked", async () => {
    renderControls(clients);
    listenForEvents();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(eventsOfType("invoice", "saved")).toHaveLength(1), { timeout: 2000 });
    expect(eventsOfType("invoice", "saved")[0].severity).toBe("success");
  });
});

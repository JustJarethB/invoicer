import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LineItemProvider, useSetLineItem } from "~/components/home/LineItems/LineItemProvider";
import { db } from "~/db";
import { emptyAddress } from "~/data/address";
import { makeClient, makeLineItem } from "~/data/testFixtures";
import { paymentDetailsFromRecord } from "~/data/payment";
import { type AppEvent, type AppEventType, eventBus } from "~/utils/events";
import { type InvoiceEditorOps, InvoiceEditorProvider, useInvoiceEditor, useInvoiceEditorOps } from "./InvoiceEditorProvider";

const client = makeClient({ id: "client-7", contactName: "Alpha", address: { ...emptyAddress(), name: "Alpha House" } });

const seededLineItems = [makeLineItem({ name: "Design", qty: 2, unitPrice: 50, type: "0", uuid: "l-1" }), makeLineItem({ uuid: "l-2" })];

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

const NameProbe = ({ field }: { field: "to" | "date" }) => {
  const editor = useInvoiceEditor();
  if (field === "to") return <p data-testid="editor-to-name">{editor.to.name || "(empty)"}</p>;
  return <p data-testid="editor-date">{editor.date}</p>;
};

type StoredLineItem = { name?: string; qty?: number; unitPrice?: number };

type StoredInvoice = {
  date: string;
  from: unknown;
  id: string;
  lineItems: StoredLineItem[];
  logo: { url: string };
  payment: { terms: string };
  payments: unknown[];
  purchaseOrder: string;
  to: unknown;
};

const EditorSetter = () => {
  const setLine = useSetLineItem("l-1");
  const { loadClientAddress, saveInvoice, setDate, setId, setPayment, setPurchaseOrder } = useInvoiceEditorOps();
  return (
    <div>
      <button
        onClick={() => {
          setId("SAVE-1");
          setDate("2026-02-02");
          setPayment({ ...paymentDetailsFromRecord({}), terms: "Net 30" });
          setPurchaseOrder("PO-9");
        }}
      >
        set-fields
      </button>
      <button onClick={() => setLine({ ...seededLineItems[0], name: "Edited" })}>edit-line</button>
      <button onClick={() => loadClientAddress("client-7")}>pick-known</button>
      <button onClick={() => loadClientAddress("gone-client")}>pick-gone</button>
      <button
        onClick={() => {
          void saveInvoice();
        }}
      >
        save
      </button>
    </div>
  );
};

let seen: InvoiceEditorOps[] = [];
const OpsRecorder = () => {
  const ops = useInvoiceEditorOps();
  useEffect(() => {
    seen.push(ops);
  }, [ops]);
  return null;
};

const mountEditor = (extra?: React.ReactNode) =>
  render(
    <LineItemProvider initialLineItems={seededLineItems}>
      <InvoiceEditorProvider clients={[client]} from={emptyAddress()} payment={paymentDetailsFromRecord({})} logo={null}>
        <EditorSetter />
        {extra}
      </InvoiceEditorProvider>
    </LineItemProvider>
  );

afterEach(() => {
  unsubscribe();
  unsubscribe = () => {};
  eventBus.subscribe(() => {})(); // drain any replayed events so a later test's subscribers stay clean
  seen = [];
  cleanup();
});

describe("InvoiceEditorProvider", () => {
  it("saveInvoice persists the current editor including fields just changed", async () => {
    mountEditor();
    await userEvent.click(screen.getByRole("button", { name: "set-fields" }));
    await userEvent.click(screen.getByRole("button", { name: "edit-line" }));
    await userEvent.click(screen.getByRole("button", { name: "save" }));

    await vi.waitFor(
      async () => {
        const stored = await db.get<StoredInvoice>(["invoice", "SAVE-1"]);
        expect(stored).not.toBeNull();
      },
      { timeout: 2000 }
    );
    const stored = await db.get<StoredInvoice>(["invoice", "SAVE-1"]);
    expect(stored).not.toBeNull();
    expect(stored?.id).toBe("SAVE-1");
    expect(stored?.date).toBe("2026-02-02");
    expect(stored?.purchaseOrder).toBe("PO-9");
    expect(stored?.logo).toEqual({ url: "" });
    expect(stored?.from).toEqual(emptyAddress());
    expect(stored?.to).toEqual(emptyAddress());
    expect(stored?.payments).toEqual([]);
    expect(stored?.payment.terms).toBe("Net 30");
    expect(stored?.lineItems).toHaveLength(2);
    expect(stored?.lineItems[0]).toMatchObject({ name: "Edited", qty: 2, unitPrice: 50 });
    expect(stored?.lineItems[1].name).toBeUndefined();
  });

  it("loads a known client into To and clears it back with a warning for an unknown id", async () => {
    listenForEvents();
    mountEditor(<NameProbe field="to" />);
    expect(screen.getByTestId("editor-to-name")).toHaveTextContent("(empty)");

    await userEvent.click(screen.getByRole("button", { name: "pick-known" }));
    expect(await screen.findByTestId("editor-to-name")).toHaveTextContent("Alpha House");

    await userEvent.click(screen.getByRole("button", { name: "pick-gone" }));
    await vi.waitFor(() => expect(screen.getByTestId("editor-to-name")).toHaveTextContent("(empty)"), { timeout: 2000 });
    expect(eventsOfType("client", "not-found")).toHaveLength(1);
    expect(eventsOfType("client", "not-found")[0].severity).toBe("warning");
    expect(eventsOfType("client", "not-found")[0].message).toBe("Selected client could not be found");
  });

  it("keeps the ops context identity stable so ops subscribers skip editor keystrokes", async () => {
    mountEditor(
      <>
        <OpsRecorder />
        <NameProbe field="date" />
      </>
    );
    expect(seen).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "set-fields" }));
    await vi.waitFor(() => expect(screen.getByTestId("editor-date")).toHaveTextContent("2026-02-02"), { timeout: 2000 });
    expect(seen).toHaveLength(1);
  });

  it("throws outside the provider", () => {
    const OutsideReader = () => {
      useInvoiceEditor();
      return null;
    };
    const OutsideOps = () => {
      useInvoiceEditorOps();
      return null;
    };
    expect(() => render(<OutsideReader />)).toThrow("useInvoiceEditor must be used inside InvoiceEditorProvider");
    cleanup();
    expect(() => render(<OutsideOps />)).toThrow("useInvoiceEditorOps must be used inside InvoiceEditorProvider");
  });
});

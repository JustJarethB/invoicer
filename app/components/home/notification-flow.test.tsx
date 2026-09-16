import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Autosave } from "~/components/home/Autosave";
import { SaveClientModal } from "~/components/home/SaveClientModal";
import { ImageInput, TextInput } from "~/components/Inputs";
import { db } from "~/db";
import { getClients } from "~/data/client";
import { paymentStatusOf, type PaymentSummary } from "~/data/invoice";
import { type AppEvent, eventBus } from "~/utils/events";
import { InvoiceProvider, PaymentModal } from "~/routes/invoices";

// The call sites publish through the app-wide singleton, which buffers
// pre-subscriber events and replays them to the first subscriber. Each test
// subscribes first and drains the replay so assertions only see what the
// test itself triggers.
const received: AppEvent[] = [];
let unsubscribe: () => void = () => {};

const listenForEvents = () => {
  unsubscribe();
  received.length = 0;
  unsubscribe = eventBus.subscribe((event) => received.push(event));
  received.length = 0; // drain any replayed history
};

const eventsOfType = (type: string) => received.filter((event) => event.type === type);

afterEach(() => {
  unsubscribe();
  unsubscribe = () => {};
  cleanup();
});

const seedInvoice = () => {
  localStorage.setItem(
    JSON.stringify(["invoice", "inv-1"]),
    JSON.stringify({
      id: "inv-1",
      date: "2026-01-01",
      purchaseOrder: "PO-1",
      logo: { url: "" },
      from: { name: "", streetAddress: "", city: "", county: "", postCode: "" },
      to: { name: "Buyer", streetAddress: "", city: "", county: "", postCode: "" },
      lineItems: [{ uuid: "l1", type: "0", qty: 2, unitPrice: 50 }],
      payments: [],
    })
  );
};

const summary: PaymentSummary = paymentStatusOf({
  lineItems: [{ uuid: "l1", type: "0", qty: 2, unitPrice: 50 }],
  payments: [],
});

const renderPaymentModal = (onClose: () => void) =>
  render(
    <InvoiceProvider>
      <PaymentModal invoiceId="inv-1" summary={summary} onClose={onClose} />
    </InvoiceProvider>
  );

describe("notification call sites", () => {
  describe("PaymentModal", () => {
    it("publishes a payment.rejected error on an invalid amount and keeps the modal open", async () => {
      // Validation errors map to severity "error" per the notification card.
      listenForEvents();
      seedInvoice();
      const onClose = vi.fn();
      renderPaymentModal(onClose);

      await userEvent.click(screen.getByRole("button", { name: /record/i }));

      const rejected = eventsOfType("payment.rejected");
      expect(rejected).toHaveLength(1);
      expect(rejected[0].severity).toBe("error");
      expect(rejected[0].message).toBe("Enter a non-zero amount");
      expect(onClose).not.toHaveBeenCalled();
      expect(eventsOfType("payment.recorded")).toHaveLength(0);
    });

    it("publishes payment.recorded exactly once after the save resolves", async () => {
      // Regression for the double-publish risk: the modal must not publish
      // success itself — makePayment is the single publish point.
      listenForEvents();
      seedInvoice();
      const onClose = vi.fn();
      renderPaymentModal(onClose);

      await userEvent.type(screen.getByRole("textbox"), "10");
      await userEvent.click(screen.getByRole("button", { name: /record/i }));

      expect(onClose).toHaveBeenCalled();
      await vi.waitFor(() => expect(eventsOfType("payment.recorded")).toHaveLength(1), { timeout: 2000 });
      // Settle past db.save's 100ms simulated delay; no second publish may arrive.
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(eventsOfType("payment.recorded")).toHaveLength(1);
      expect(eventsOfType("payment.recorded")[0].severity).toBe("success");
      expect(eventsOfType("payment.recorded")[0].context).toMatchObject({ invoiceId: "inv-1", amount: 10 });
    });

    it("publishes payment.failed instead of success when persisting the payment rejects", async () => {
      // A rejected save must never surface as a confirmation.
      listenForEvents();
      seedInvoice();
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      const onClose = vi.fn();
      renderPaymentModal(onClose);

      await userEvent.type(screen.getByRole("textbox"), "10");
      await userEvent.click(screen.getByRole("button", { name: /record/i }));

      await vi.waitFor(() => expect(eventsOfType("payment.failed")).toHaveLength(1), { timeout: 2000 });
      expect(eventsOfType("payment.failed")[0].severity).toBe("error");
      expect(eventsOfType("payment.recorded")).toHaveLength(0);
    });
  });

  describe("SaveClientModal", () => {
    it("publishes client.saved on success and closes the modal", async () => {
      listenForEvents();
      const onClose = vi.fn();
      render(<SaveClientModal record={{ name: "Acme", streetAddress: "1 Way" }} onClose={onClose} onSaved={() => {}} />);

      await userEvent.type(screen.getByPlaceholderText("Display Name"), "Acme Co");
      await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(async () => {
        const clients = await getClients();
        expect(clients).toHaveLength(1);
        expect(clients[0].contactName).toBe("Acme Co");
      });
      // The publish rides the save's own promise chain (two 100ms simulated
      // delays), so it can land after getClients already sees the data.
      await vi.waitFor(() => expect(eventsOfType("client.saved")).toHaveLength(1));
      expect(eventsOfType("client.saved")[0].severity).toBe("success");
      expect(onClose).toHaveBeenCalled();
    });

    it("publishes client.failed and keeps the modal open when the client save rejects", async () => {
      listenForEvents();
      const onClose = vi.fn();
      const onSaved = vi.fn();
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      render(<SaveClientModal record={{ name: "Acme", streetAddress: "1 Way" }} onClose={onClose} onSaved={onSaved} />);

      await userEvent.type(screen.getByPlaceholderText("Display Name"), "Acme Co");
      await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

      await vi.waitFor(() => expect(eventsOfType("client.failed")).toHaveLength(1));
      expect(eventsOfType("client.failed")[0].severity).toBe("error");
      expect(onClose).not.toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
      expect(eventsOfType("client.saved")).toHaveLength(0);
    });
  });

  describe("Autosave", () => {
    it("publishes autosave.failed as a warning and clears the spinner when the save rejects", async () => {
      // Silent failure path: without the publish the spinner spun forever and
      // the user was never told.
      listenForEvents();
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      render(
        <Autosave name="test-form">
          <TextInput name="field" defaultValue="" onChange={() => {}} />
        </Autosave>
      );

      await userEvent.type(screen.getByRole("textbox"), "y");

      await vi.waitFor(() => expect(eventsOfType("autosave.failed")).toHaveLength(1));
      expect(eventsOfType("autosave.failed")[0].severity).toBe("warning");
      await waitFor(() => {
        const icon = document.querySelector("svg.cursor-help");
        expect(icon).not.toHaveClass("animate-spin");
      });
    });
  });

  describe("db", () => {
    it("aggregates corrupt localStorage keys into a single storage.unreadable warning", async () => {
      // One event per scan, however many keys are corrupt — a corrupt store
      // must not flood the harness.
      listenForEvents();
      localStorage.setItem("not-json", "x");

      const result = await db.getAll<{ id: string }>(["invoice"]);

      expect(result).toHaveLength(0);
      const unreadable = eventsOfType("storage.unreadable");
      expect(unreadable).toHaveLength(1);
      expect(unreadable[0].severity).toBe("warning");
      expect(unreadable[0].message).toContain("1");
    });
  });

  describe("ImageInput", () => {
    it("publishes image.unselected as debug when the file picker is cancelled", () => {
      // A cancel is routine, not a recoverable issue: debug stays off the
      // toast severities so no spurious toast appears.
      listenForEvents();
      const { container } = render(<ImageInput name="logo" alt="logo" />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input);

      const unselected = eventsOfType("image.unselected");
      expect(unselected).toHaveLength(1);
      expect(unselected[0].severity).toBe("debug");
    });
  });
});

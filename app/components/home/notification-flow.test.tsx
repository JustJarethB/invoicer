import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Autosave } from "~/components/home/Autosave";
import { SaveClientModal } from "~/components/home/SaveClientModal";
import { ImageInput, TextInput } from "~/components/Inputs";
import { db } from "~/db";
import { getClients } from "~/data/client";
import { makeInvoice } from "~/data/testFixtures";
import { type AppEvent, type AppEventType, eventBus } from "~/utils/events";
import Invoices from "~/routes/invoices";

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

afterEach(() => {
  unsubscribe();
  unsubscribe = () => {};
  cleanup();
});

const seedInvoice = () => {
  localStorage.setItem(JSON.stringify(["invoice", "inv-1"]), JSON.stringify(makeInvoice()));
};

const renderInvoices = () => render(<Invoices />);

const openPaymentModal = async () => {
  await renderInvoices().findByText("inv-1");
  await userEvent.click(screen.getByRole("button", { name: "Unpaid" }));
  await screen.findByRole("heading", { name: "Record payment for inv-1" });
};

describe("notification call sites", () => {
  describe("PaymentModal", () => {
    it("keeps the modal open and shows inline error text on an invalid amount without publishing", async () => {
      listenForEvents();
      seedInvoice();
      await openPaymentModal();

      await userEvent.click(screen.getByRole("button", { name: "Record" }));

      expect(received).toHaveLength(0);
      expect(screen.getByText("Enter a non-zero amount")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Record payment for inv-1" })).toBeInTheDocument();
    });

    it("publishes payment.recorded exactly once after the save resolves", async () => {
      listenForEvents();
      seedInvoice();
      await openPaymentModal();

      await userEvent.type(screen.getByRole("textbox"), "10");
      await userEvent.click(screen.getByRole("button", { name: "Record" }));

      await vi.waitFor(() => expect(screen.queryByRole("heading", { name: "Record payment for inv-1" })).not.toBeInTheDocument(), { timeout: 2000 });
      await vi.waitFor(() => expect(eventsOfType("payment", "recorded")).toHaveLength(1), { timeout: 2000 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(eventsOfType("payment", "recorded")).toHaveLength(1);
      expect(eventsOfType("payment", "recorded")[0].severity).toBe("success");
      expect(eventsOfType("payment", "recorded")[0].context).toMatchObject({ invoiceId: "inv-1", amount: 10 });
    });

    it("publishes payment.failed instead of success when persisting the payment rejects", async () => {
      listenForEvents();
      seedInvoice();
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      await openPaymentModal();

      await userEvent.type(screen.getByRole("textbox"), "10");
      await userEvent.click(screen.getByRole("button", { name: "Record" }));

      await vi.waitFor(() => expect(eventsOfType("payment", "failed")).toHaveLength(1), { timeout: 2000 });
      expect(eventsOfType("payment", "failed")[0].severity).toBe("error");
      expect(screen.getByText("quota exceeded")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Record payment for inv-1" })).toBeInTheDocument();
      expect(eventsOfType("payment", "recorded")).toHaveLength(0);
    });

    it("publishes payment.failed and keeps the modal open when the save reports failure", async () => {
      listenForEvents();
      seedInvoice();
      vi.spyOn(db, "save").mockResolvedValue(false);
      await openPaymentModal();

      await userEvent.type(screen.getByRole("textbox"), "10");
      await userEvent.click(screen.getByRole("button", { name: "Record" }));

      await vi.waitFor(() => expect(eventsOfType("payment", "failed")).toHaveLength(1), { timeout: 2000 });
      expect(eventsOfType("payment", "failed")[0].severity).toBe("error");
      expect(screen.getByRole("heading", { name: "Record payment for inv-1" })).toBeInTheDocument();
      expect(eventsOfType("payment", "recorded")).toHaveLength(0);
    });

    it("disables the Record control while the save is in flight and records the payment once", async () => {
      listenForEvents();
      seedInvoice();
      let resolveSave: (saved: boolean) => void = () => {};
      vi.spyOn(db, "save").mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveSave = resolve;
          })
      );
      await openPaymentModal();

      await userEvent.type(screen.getByRole("textbox"), "10");
      await userEvent.click(screen.getByRole("button", { name: "Record" }));

      expect(screen.getByRole("button", { name: "Record" })).toBeDisabled();

      resolveSave(true);
      await vi.waitFor(() => expect(screen.queryByRole("heading", { name: "Record payment for inv-1" })).not.toBeInTheDocument(), { timeout: 2000 });
      await vi.waitFor(() => expect(eventsOfType("payment", "recorded")).toHaveLength(1), { timeout: 2000 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(eventsOfType("payment", "recorded")).toHaveLength(1);
    });
  });

  describe("InvoiceTable", () => {
    it("removes the row and publishes invoice.deleted only after the remove succeeds", async () => {
      listenForEvents();
      seedInvoice();
      let resolveRemove: (removed: boolean) => void = () => {};
      vi.spyOn(db, "remove").mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveRemove = resolve;
          })
      );
      renderInvoices();
      await screen.findByText("inv-1");
      await userEvent.click(screen.getByRole("button", { name: "Delete invoice inv-1" }));

      expect(eventsOfType("invoice", "deleted")).toHaveLength(0);
      expect(screen.getByText("inv-1")).toBeInTheDocument();

      resolveRemove(true);
      await vi.waitFor(() => expect(eventsOfType("invoice", "deleted")).toHaveLength(1));
      expect(screen.queryByText("inv-1")).not.toBeInTheDocument();
    });

    it("publishes invoice.delete.failed and keeps the row when the remove reports failure", async () => {
      listenForEvents();
      seedInvoice();
      let resolveRemove: (removed: boolean) => void = () => {};
      vi.spyOn(db, "remove").mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveRemove = resolve;
          })
      );
      renderInvoices();
      await screen.findByText("inv-1");
      await userEvent.click(screen.getByRole("button", { name: "Delete invoice inv-1" }));

      resolveRemove(false);
      await vi.waitFor(() => expect(eventsOfType("invoice", "delete.failed")).toHaveLength(1));
      expect(eventsOfType("invoice", "delete.failed")[0].severity).toBe("error");
      expect(screen.getByText("inv-1")).toBeInTheDocument();
      expect(eventsOfType("invoice", "deleted")).toHaveLength(0);
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
      await vi.waitFor(() => expect(eventsOfType("client", "saved")).toHaveLength(1));
      expect(eventsOfType("client", "saved")[0].severity).toBe("success");
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Autosave", () => {
    it("publishes autosave.failed as a warning and clears the spinner when the save rejects", async () => {
      listenForEvents();
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      render(
        <Autosave name="from-address">
          <TextInput name="field" defaultValue="" onChange={() => {}} />
        </Autosave>
      );

      await userEvent.type(screen.getByRole("textbox"), "y");

      await vi.waitFor(() => expect(eventsOfType("autosave", "failed")).toHaveLength(1));
      expect(eventsOfType("autosave", "failed")[0].severity).toBe("warning");
      await waitFor(() => {
        const icon = document.querySelector("svg.cursor-help");
        expect(icon).not.toHaveClass("animate-spin");
      });
    });
  });

  describe("db", () => {
    it("aggregates corrupt localStorage keys into a single storage.unreadable warning", async () => {
      listenForEvents();
      localStorage.setItem("not-json", "x");

      const result = await db.getAll(["invoice"]);

      expect(result).toHaveLength(0);
      const unreadable = eventsOfType("storage", "unreadable");
      expect(unreadable).toHaveLength(1);
      expect(unreadable[0].severity).toBe("warning");
      expect(unreadable[0].message).toBe("1 saved entry could not be read and was skipped");
    });
  });

  describe("ImageInput", () => {
    it("publishes image.unselected as debug when the file picker is cancelled", () => {
      listenForEvents();
      const { container } = render(<ImageInput name="logo" alt="logo" />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input);

      const unselected = eventsOfType("image", "unselected");
      expect(unselected).toHaveLength(1);
      expect(unselected[0].severity).toBe("debug");
    });
  });
});

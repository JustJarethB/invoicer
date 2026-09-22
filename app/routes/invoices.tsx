import { TrashIcon } from "@heroicons/react/24/outline";
import * as outline from "@heroicons/react/24/outline";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";
import { Button } from "~/components/home/Button";
import { Status } from "~/components/home/Status";
import { Modal } from "~/components/Modal";
import { NumberInput } from "~/components/Inputs";
import { type Invoice, type Payment, paymentStatusOf, type PaymentSummary } from "~/data/invoice";
import { db } from "~/db";
import { useMobile } from "~/hooks";
import type { Route } from "./+types/invoices";
import { isValidPaymentAmount } from "../utils/isValidPaymentAmount";
import { formatCurrency } from "~/utils/formatCurrency";
import { errorMessage, eventBus, publishError, rethrowError } from "~/utils/events";

export function meta() {
  return [{ title: "Invoices" }];
}

type InvoiceContext = {
  invoices: Invoice[];
  makePayment: (invoiceId: Invoice["id"], amount: number) => Promise<boolean>;
  deleteInvoice: (invoiceID: Invoice["id"]) => Promise<void>;
};
const InvoiceContext = createContext<InvoiceContext>({
  invoices: [],
  makePayment: async (): Promise<boolean> => {
    throw new Error("Function not implemented.");
  },
  deleteInvoice: async (): Promise<void> => {
    throw new Error("Function not implemented");
  },
});

const InvoiceProvider = ({ children }: PropsWithChildren) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const makePayment = async (invoiceId: string, amount: number): Promise<boolean> => {
    if (!isValidPaymentAmount(amount)) {
      throw new Error(`Payment rejected: invalid amount ${amount} for invoice ${invoiceId}`);
    }

    const newPayment: Payment = {
      amount,
      date: new Date().toISOString(),
      method: "Bank Transfer",
      reference: `INV-${invoiceId}`,
    };
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) {
      rethrowError(eventBus, { type: "payment", context: { invoiceId, action: "failed" } }, new Error(`Invoice with id ${invoiceId} not found`));
    }
    const savedInvoice = { ...invoice, payments: [...(invoice.payments ?? []), newPayment] };
    let saved: boolean;
    try {
      saved = await db.save(["invoice", invoiceId], savedInvoice);
    } catch (e) {
      // Rethrows to the parental catch (PaymentModal.submit): its publishError
      // safety net finds this value published and adds nothing (exactly-once).
      rethrowError(eventBus, { type: "payment", message: "Payment could not be saved", context: { invoiceId, amount, action: "failed" } }, e);
    }
    if (!saved) {
      eventBus.publish({
        type: "payment",
        severity: "error",
        message: "Payment could not be saved",
        context: { invoiceId, amount, action: "failed" },
      });
      return false;
    }
    // Single publish point for payment confirmations: the modal must not also
    // publish success, or every payment surfaces twice.
    eventBus.publish({ type: "payment", severity: "success", message: "Payment recorded", context: { invoiceId, amount, action: "recorded" } });
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, payments: [...(inv.payments ?? []), newPayment] } : inv)));
    return true;
  };

  const deleteInvoice = async (invoiceId: string): Promise<void> => {
    let removed: boolean;
    try {
      removed = await db.remove(["invoice", invoiceId]);
    } catch (e) {
      // Rethrows to the parental boundary: the caller is fire-and-forget, so
      // the rethrown error floats to the global rejection catcher, which sees
      // this value already published and adds nothing (exactly-once).
      rethrowError(eventBus, { type: "invoice", message: "Invoice could not be deleted", context: { invoiceId, action: "delete.failed" } }, e);
    }
    if (!removed) {
      eventBus.publish({
        type: "invoice",
        severity: "error",
        message: "Invoice could not be deleted",
        context: { invoiceId, action: "delete.failed" },
      });
      return;
    }
    eventBus.publish({ type: "invoice", severity: "success", message: "Invoice deleted", context: { invoiceId, action: "deleted" } });
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
  };
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const fetchedInvoices = (await db.getAll(["invoice"])) as Invoice[];
        setInvoices(fetchedInvoices);
      } catch (e) {
        // A corrupt stored value crashes db.get's JSON.parse; without this
        // guard the invoice list silently rendered empty.
        eventBus.publish({
          type: "invoice",
          severity: "warning",
          message: "Saved invoices could not be loaded",
          context: { action: "load.failed", error: e },
        });
      }
    };
    fetchInvoices();
  }, []);
  const value = {
    invoices,
    makePayment,
    deleteInvoice,
  } satisfies InvoiceContext;
  return <InvoiceContext.Provider value={value}>{children}</InvoiceContext.Provider>;
};
const useMakePayment = () => useContext(InvoiceContext).makePayment;
const useInvoices = () => useContext(InvoiceContext).invoices;
const useInvoiceIds = () => useInvoices().map((invoice) => invoice.id);
const useInvoice = (invoiceId: string) => {
  const maybeInvoice = useInvoices().find((invoice) => invoice.id === invoiceId);
  if (!maybeInvoice) {
    throw new Error(`Invoice with id ${invoiceId} not found`);
  }
  return maybeInvoice;
};

export default function Invoices() {
  return (
    <InvoiceProvider>
      <InvoiceTable />
    </InvoiceProvider>
  );
}

function InvoiceTable() {
  const invoices = useInvoiceIds();
  return (
    <table className="mt-16 mb-4 container mx-auto max-w-5xl w-4/5 grid gap-4 grid-cols-[0.75fr_1fr_1fr_2fr_2fr_0.5fr_0.5fr_0.75fr]">
      <thead className="grid grid-cols-subgrid col-span-full">
        <tr className="grid grid-cols-subgrid col-span-full font-bold py-4 border-b border-gray-700">
          <th className="text-left col-start-2">Invoice Ref</th>
          <th className="text-left">Tax Date</th>
          <th className="text-left">PO / Reference</th>
          <th className="text-left">To</th>
          <th className="text-left">Total</th>
          <th className="text-left">Due</th>
          <th className="text-left"></th>
        </tr>
      </thead>
      <tbody className="grid gap-4 grid-cols-subgrid col-span-full">
        {invoices.map((id) => (
          <InvoiceRow key={id} id={id} />
        ))}
      </tbody>
    </table>
  );
}

const InvoiceRow = ({ id }: { id: string }) => {
  const invoice = useInvoice(id);
  const deleteInvoice = useContext(InvoiceContext).deleteInvoice;
  const summary = paymentStatusOf(invoice);
  const { due, paymentStatus, totalDue } = summary;
  const [open, setOpen] = useState(false);
  const mobile = useMobile();
  const handleDelete = () => {
    // todo: add confirmation modal
    deleteInvoice(id);
  };
  return (
    <tr
      className={`px-2 grid grid-cols-subgrid py-4 col-span-full group transition-colors items-center rounded-md ${open ? "bg-white/5 hover:bg-white/6" : "hover:bg-white/5"} ${"cursor-pointer md:cursor-default"}`}
      onClick={() => mobile && setOpen((o) => !o)}
    >
      <td className="flex justify-end gap-2 grid-cols-1">
        <Button icon outline color="danger" size="sm" aria-label={`Delete invoice ${id}`} onClick={() => handleDelete()}>
          <TrashIcon className="size-5" />
        </Button>
        <Button
          className="hidden md:block"
          icon
          outline
          size="sm"
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          <outline.EyeIcon className="size-5" />
        </Button>
      </td>
      <td className="text-sm">{invoice.id}</td>
      <td className="text-sm">{invoice.date}</td>
      <td className="text-sm">{invoice.purchaseOrder}</td>
      <td className="text-sm">{invoice.to.name}</td>
      <td className="text-sm">£ {formatCurrency(totalDue)}</td>
      <td className={`text-sm ${paymentStatus === "overpaid" ? "text-amber-700" : ""}`}>£ {formatCurrency(due)}</td>
      <td className="text-center">
        <PaidStatus id={id} summary={summary} />
      </td>
      {open && (
        <td className="col-start-2 col-span-full pt-4 space-y-2">
          <span className="visible md:hidden">
            <p className="text-sm">
              <strong>PO / Reference:</strong> {invoice.purchaseOrder}
            </p>
            <p className="text-sm">
              <strong>Total Due:</strong> £{formatCurrency(totalDue)}
            </p>
          </span>
          <p className="text-sm mb-2">
            <strong>Line items:</strong>
          </p>
          {invoice.lineItems.map((item) => (
            <div key={item.uuid} className="space-x-4 mt-2">
              <span className="text-md">{item.description}</span>
              {item.unitPrice !== undefined && <span className="text-sm">£{formatCurrency(item.unitPrice)}</span>}
              {item.type === "2" && item.qty !== undefined && <span className="text-sm">qty: {item.qty}</span>}
            </div>
          ))}
        </td>
      )}
    </tr>
  );
};

/**
 * Click-to-pay control. Opens a small modal instead of window.prompt so the
 * amount is validated by a real input rather than `parseFloat` on free text.
 */
const PaidStatus = ({ id, summary }: { id: string; summary: PaymentSummary }) => {
  const { paymentStatus } = summary;
  const [showPayment, setShowPayment] = useState(false);
  const color = paymentStatus === "paid" ? "success" : paymentStatus === "unpaid" ? "danger" : "warning";
  return (
    <>
      <Status
        size="sm"
        onClick={() => {
          if (paymentStatus !== "paid") setShowPayment(true);
        }}
        color={color}
      >
        {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
      </Status>
      {showPayment && <PaymentModal invoiceId={id} summary={summary} onClose={() => setShowPayment(false)} />}
    </>
  );
};

const PaymentModal = ({ invoiceId, onClose, summary }: { invoiceId: string; summary: PaymentSummary; onClose: () => void }) => {
  const makePayment = useMakePayment();
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    if (amount === undefined || !isValidPaymentAmount(amount)) {
      setError("Enter a non-zero amount");
      return;
    }
    setSubmitting(true);
    try {
      if (await makePayment(invoiceId, amount)) onClose();
    } catch (e) {
      // publishError is the safety net: it derives the message, normalises
      // context.error, and skips already-published values (rethrowError sites).
      publishError(eventBus, { type: "payment", context: { invoiceId, action: "failed" } }, e);
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Record payment for ${invoiceId}`} onClose={onClose}>
      <p className="text-sm mb-1">
        Outstanding: <strong>£{formatCurrency(summary.due)}</strong>
      </p>
      <NumberInput
        autoFocus
        name="amount"
        prefix="£"
        placeholder="0.00"
        value={amount}
        onChange={setAmount}
        inputClassName="text-right"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      <div className="flex justify-end gap-4 pt-4">
        <Button color="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button color="success" onClick={submit} disabled={submitting}>
          Record
        </Button>
      </div>
    </Modal>
  );
};

/**
 * Route-level error boundary (React Router framework mode). React Router
 * delivers the error through useRouteError (the prop is the framework-mode
 * fallback). The publish is deferred with queueMicrotask — bus listeners such
 * as Toaster may call setState, which is illegal in another component's
 * render — then the boundary rethrows so the root boundary (root.tsx) renders
 * the fallback. Client-only publish: the server's bus has no consumer, so SSR
 * render failures stay on the SSR error path.
 */
export function ErrorBoundary({ error: routeError }: Partial<Route.ErrorBoundaryProps> = {}) {
  const error = useRouteError() ?? routeError;
  // Neither delivery channel carried an error: nothing to capture, nothing to delegate.
  if (error === undefined) return null;
  if (typeof window !== "undefined") {
    queueMicrotask(() =>
      publishError(
        eventBus,
        {
          type: "invoice",
          message: isRouteErrorResponse(error) ? error.statusText || `HTTP ${error.status}` : errorMessage(error),
          context: { action: "route-error", boundary: "invoices" },
        },
        error
      )
    );
  }
  throw error;
}

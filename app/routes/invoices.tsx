import { TrashIcon } from "@heroicons/react/24/outline";
import * as outline from "@heroicons/react/24/outline";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { Button } from "~/components/home/Button";
import { Status } from "~/components/home/Status";
import { Modal } from "~/components/Modal";
import { NumberInput } from "~/components/Inputs";
import { paymentStatusOf, type Invoice, type Payment, type PaymentSummary } from "~/data/invoice";
import { db } from "~/db";
import { useMobile } from "~/hooks";
import { isValidPaymentAmount } from "../utils/isValidPaymentAmount";
import { formatCurrency } from "~/utils/formatCurrency";

export function meta() {
  return [{ title: "Invoices" }];
}

type InvoiceContext = {
  invoices: Invoice[];
  makePayment: (invoiceId: Invoice["id"], amount: number) => void;
  deleteInvoice: (invoiceID: Invoice["id"]) => void;
};
const InvoiceContext = createContext<InvoiceContext>({
  invoices: [],
  makePayment: function (): void {
    throw new Error("Function not implemented.");
  },
  deleteInvoice: function (): void {
    throw new Error("Function not implemented");
  },
});

const InvoiceProvider = ({ children }: PropsWithChildren) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const makePayment = (invoiceId: string, amount: number) => {
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
      throw new Error(`Invoice with id ${invoiceId} not found`);
    }
    const newInvoice = { ...invoice, payments: [...(invoice.payments ?? []), newPayment] };
    db.save(["invoice", invoiceId], newInvoice);
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? newInvoice : inv)));
  };

  const deleteInvoice = (invoiceId: string) => {
    db.remove(["invoice", invoiceId]);
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
  };
  useEffect(() => {
    const fetchInvoices = async () => {
      const fetchedInvoices = (await db.getAll(["invoice"])) as Invoice[];
      setInvoices(fetchedInvoices);
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
  const { totalDue, due, paymentStatus } = summary;
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
        <Button icon outline color="danger" size="sm" onClick={() => handleDelete()}>
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

const PaymentModal = ({ invoiceId, summary, onClose }: { invoiceId: string; summary: PaymentSummary; onClose: () => void }) => {
  const makePayment = useMakePayment();
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (amount === undefined || !isValidPaymentAmount(amount)) {
      setError("Enter a non-zero amount");
      return;
    }
    try {
      makePayment(invoiceId, amount);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
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
        <Button color="success" onClick={submit}>
          Record
        </Button>
      </div>
    </Modal>
  );
};

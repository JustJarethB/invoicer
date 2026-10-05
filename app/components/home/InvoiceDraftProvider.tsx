import { createContext, type ReactNode, useContext, useMemo, useRef, useState } from "react";
import { useLineItems } from "~/components/home/LineItems/LineItemProvider";
import { type Address, emptyAddress } from "~/data/address";
import { type Client, createClientAddressLoader } from "~/data/client";
import { type Invoice, type Logo } from "~/data/invoice";
import { type PaymentDetails } from "~/data/payment";
import { db } from "~/db";
import { eventBus, withErrorReporting } from "~/utils/events";

export type InvoiceDraftState = {
  date: string;
  from: Address;
  id: string;
  logo: Logo | null;
  payment: PaymentDetails;
  purchaseOrder: string;
  to: Address;
};

export type InvoiceDraftOps = {
  loadClientAddress: (clientId: string) => void;
  saveInvoice: () => Promise<void>;
  setDate: (date: string) => void;
  setFrom: (from: Address) => void;
  setId: (id: string) => void;
  setLogo: (logo: Logo) => void;
  setPayment: (payment: PaymentDetails) => void;
  setPurchaseOrder: (purchaseOrder: string) => void;
  setTo: (to: Address) => void;
};

const InvoiceDraftContext = createContext<InvoiceDraftState | null>(null);
const InvoiceDraftOpsContext = createContext<InvoiceDraftOps | null>(null);

export const useInvoiceDraft = (): InvoiceDraftState => {
  const draft = useContext(InvoiceDraftContext);
  if (!draft) throw new Error("useInvoiceDraft must be used inside InvoiceDraftProvider");
  return draft;
};

export const useInvoiceDraftOps = (): InvoiceDraftOps => {
  const ops = useContext(InvoiceDraftOpsContext);
  if (!ops) throw new Error("useInvoiceDraftOps must be used inside InvoiceDraftProvider");
  return ops;
};

/**
 * Renders inside `LineItemProvider`: outside it, `useLineItems` falls back to
 * its empty default and save silently persists no line items.
 */
export const InvoiceDraftProvider = ({
  children,
  clients,
  from,
  logo,
  payment,
}: {
  children: ReactNode;
  clients: Client[];
  from: Address;
  logo: Logo | null;
  payment: PaymentDetails;
}) => {
  const [id, setId] = useState<string>(`${new Date().getTime()}`.substring(0, 10));
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [purchaseOrder, setPurchaseOrder] = useState<string>("---");
  const [logoState, setLogoState] = useState<Logo | null>(logo);
  const [fromState, setFromState] = useState<Address>(from);
  const [paymentState, setPaymentState] = useState<PaymentDetails>(payment);
  const [to, setTo] = useState<Address>(emptyAddress());
  const lineItems = useLineItems();

  // The mirror is written during render (not in an effect) by design: only
  // event callbacks read it, never render code, so no render observes a torn read.
  const latest = useRef({ id, date, from: fromState, lineItems, logo: logoState, payment: paymentState, purchaseOrder, to });
  latest.current = { id, date, from: fromState, lineItems, logo: logoState, payment: paymentState, purchaseOrder, to };

  const saveInvoice = useMemo(
    () => async (): Promise<void> => {
      const draft = latest.current;
      const invoice: Invoice = {
        payments: [],
        id: draft.id,
        date: draft.date,
        purchaseOrder: draft.purchaseOrder,
        logo: draft.logo ?? { url: "" },
        from: draft.from,
        to: draft.to,
        lineItems: draft.lineItems,
        payment: draft.payment,
      };
      await withErrorReporting({ type: "invoice", message: "Invoice could not be saved", context: { invoiceId: draft.id, action: "failed" } }, () =>
        db.save(["invoice", draft.id], invoice)
      );
      eventBus.publish({ type: "invoice", severity: "success", message: "Invoice saved", context: { invoiceId: draft.id, action: "saved" } });
    },
    []
  );
  const loadClientAddress = useMemo(() => createClientAddressLoader(clients, setTo), [clients]);

  const draft = useMemo<InvoiceDraftState>(
    () => ({ id, date, from: fromState, logo: logoState, payment: paymentState, purchaseOrder, to }),
    [id, date, fromState, logoState, paymentState, purchaseOrder, to]
  );
  const ops = useMemo<InvoiceDraftOps>(
    () => ({
      setId,
      setDate,
      setPurchaseOrder,
      setLogo: setLogoState,
      setFrom: setFromState,
      setTo,
      setPayment: setPaymentState,
      loadClientAddress,
      saveInvoice,
    }),
    [loadClientAddress, saveInvoice]
  );

  return (
    <InvoiceDraftContext.Provider value={draft}>
      <InvoiceDraftOpsContext.Provider value={ops}>{children}</InvoiceDraftOpsContext.Provider>
    </InvoiceDraftContext.Provider>
  );
};

import { BanknotesIcon, TrashIcon } from "@heroicons/react/24/outline";
import * as outline from "@heroicons/react/24/outline";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { Button } from "~/components/home/Button";
import type { LineItem } from "~/components/home/LineItems/LineItemProvider";
import { Status } from "~/components/home/Status";
import { withProvider } from "~/components/home/withProvider";
import type { Address } from "~/data/address";
import { db } from "~/db";
import { linePrice } from "~/utils/linePrice";


type Payment = { amount: number, date: string, method?: string, reference?: string }
type Invoice = {
    id: string,
    date: string;
    purchaseOrder: string;
    logo: { url: string };
    from: Address;
    to: Address;
    lineItems: LineItem[]
    payments: Payment[]
}
type InvoiceContext = {
    invoices: Invoice[]
    makePayment: (invoiceId: Invoice['id'], amount: number) => void;
}
const InvoiceContext = createContext<InvoiceContext>({
    invoices: [],
    makePayment: function (invoiceId: string, amount: number): void {
        throw new Error("Function not implemented.");
    }
})

const InvoiceProvider = ({ children }: PropsWithChildren) => {
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const makePayment = (invoiceId: string, amount: number) => {
        const newPayment: Payment = {
            amount,
            date: new Date().toISOString(),
            method: "Bank Transfer",
            reference: `INV-${invoiceId}`
        };
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        if (!invoice) {
            throw new Error(`Invoice with id ${invoiceId} not found`);
        }
        // TODO: remove null check once done properly
        const newInvoice = { ...invoice, payments: [...(invoice.payments ?? []), newPayment] }
        db.save(["invoice", invoiceId], newInvoice);
        setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? newInvoice : inv)));
    }
    useEffect(() => {
        const fetchInvoices = async () => {
            const fetchedInvoices = await db.getAll(["invoice"]) as Invoice[]
            setInvoices(fetchedInvoices);
        }
        fetchInvoices();
    }, [])
    const value = {
        invoices,
        makePayment
    } satisfies InvoiceContext
    return <InvoiceContext.Provider value={value}>{children}</InvoiceContext.Provider>
}
const useMakePayment = () => useContext(InvoiceContext).makePayment;
const useInvoices = () => useContext(InvoiceContext).invoices
const useInvoiceIds = () => useInvoices().map((invoice) => invoice.id)
const useInvoice = (invoiceId: string) => {
    const maybeInvoice = useInvoices().find((invoice) => invoice.id === invoiceId);
    if (!maybeInvoice) {
        throw new Error(`Invoice with id ${invoiceId} not found`);
    }
    return maybeInvoice;
}
const useInvoiceTotal = (invoiceId: string) => useInvoice(invoiceId).lineItems.map(linePrice).reduce((p, c) => p + c, 0);
const useInvoicePaymentStatus = (invoiceId: string) => {
    const { payments } = useInvoice(invoiceId)
    const totalDue = useInvoiceTotal(invoiceId)
    // TODO: remove null check once done properly
    const totalPaid = (payments ?? []).map((p) => p.amount).reduce((p, c) => p + c, 0);
    return { totalDue, totalPaid, overpaid: totalPaid > totalDue, paid: totalPaid >= totalDue, partial: totalPaid > 0 && totalPaid < totalDue, due: totalDue - totalPaid }
}
const withInvoiceProvider = withProvider(InvoiceProvider)

export default withInvoiceProvider(function Invoices() {
    const invoices = useInvoiceIds()
    return (
        <main className="pt-16 pb-4 container mx-auto">
            <div className="grid grid-cols-8">
                <div className="grid gap-4 grid-cols-subgrid col-span-full font-bold cursor-pointer py-4">
                    <div></div>
                    <div className="">Invoice Ref</div>
                    <div className="">Tax Date</div>
                    <div className="">PO / Reference</div>
                    <div className="">To</div>
                    <div className="">Total</div>
                    <div className="">Due</div>
                    <div className=""></div>
                </div>
                {invoices.map((id) => (
                    <InvoiceRow key={id} id={id} />
                ))}
            </div>
        </main>
    );
})

const InvoiceRow = ({ id }: { id: string }) => {
    const makePayment = useMakePayment()
    const invoice = useInvoice(id)
    const { totalDue, due, overpaid } = useInvoicePaymentStatus(id)

    return (
        <div className="grid gap-4 grid-cols-subgrid py-2 col-span-full group hover:bg-white/5 transition-colors">
            <div className="flex justify-end gap-2">
                <Button icon outline color="danger" disabled size="sm">
                    <TrashIcon className="h-5" />
                </Button>
                <Button icon outline onClick={() => makePayment(id, parseFloat(prompt("Amount") ?? "0"))} color="success" size="sm">
                    <BanknotesIcon className="h-5" />
                </Button>
                <Button icon outline disabled size="sm">
                    <outline.EyeIcon className="h-5" />
                </Button>

            </div>
            <div>{invoice.id}</div>
            <div>{invoice.date}</div>
            <div>{invoice.purchaseOrder}</div>
            <div>{invoice.to.name}</div>
            <div>£ {totalDue}</div>
            <div className={overpaid ? "text-amber-700" : ""}>£ {due}</div>
            <div className="">
                <PaidStatus id={id} />
            </div>
        </div>
    )
}
const PaidStatus = ({ id }: { id: string }) => {
    const { paid, partial, overpaid } = useInvoicePaymentStatus(id)
    if (overpaid)
        return <Status color="warning" size="sm">Overpaid</Status>
    if (paid)
        return <Status color="success" size="sm">Paid</Status>
    if (partial)
        return <Status color="warning" size="sm">Partial</Status>
    return <Status color="danger" size="sm">Unpaid</Status>
}
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

export function meta() {
    return [
        { title: "Invoices" },
    ];
}

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
})

const InvoiceRow = ({ id }: { id: string }) => {
    const invoice = useInvoice(id)
    const { totalDue, due, overpaid } = useInvoicePaymentStatus(id)
    const [open, setOpen] = useState(false);
    return (
        <tr className={`grid grid-cols-subgrid py-4 col-span-full group transition-colors items-center rounded-md ${open ? "bg-white/5 hover:bg-white/6" : "hover:bg-white/5"}`}>
            <td className="flex justify-end gap-2 grid-cols-1">
                <Button icon outline color="danger" disabled size="sm">
                    <TrashIcon className="size-5"/>
                </Button>
                <Button icon outline size="sm" onClick={() => {setOpen(o => !o)}}>
                    <outline.EyeIcon className="size-5" />
                </Button>
            </td>
            <td className="text-sm">{invoice.id}</td>
            <td className="text-sm">{invoice.date}</td>
            <td className="text-sm">{invoice.purchaseOrder}</td>
            <td className="text-sm">{invoice.to.name}</td>
            <td className="text-sm">£ {totalDue}</td>
            <td className={`text-sm ${overpaid ? "text-amber-700" : ""}`}>£ {due}</td>
            <td className="">
                <PaidStatus id={id} />
            </td>
            {open && (
                <div className="col-start-2 col-span-full pt-4">
                    <span>Line items:</span>
                    {invoice.lineItems.map(((item) => (
                        <div key={item.uuid}>
                            <span className="text-sm">{item.description}</span>
                            <span className="text-sm">{item.unitPrice}</span>
                        </div>
                    )))}
                </div>
            )}
        </tr>
    )
}
const PaidStatus = ({ id }: { id: string }) => {
    const makePayment = useMakePayment()
    const { paid, partial, overpaid } = useInvoicePaymentStatus(id)
    if (overpaid)
        return <Status color="warning" size="sm" onClick={() => makePayment(id, parseFloat(prompt("Amount") ?? "0"))}>Overpaid</Status>
    if (paid)
        return <Status color="success" size="sm">Paid</Status>
    if (partial)
        return <Status color="warning" size="sm" onClick={() => makePayment(id, parseFloat(prompt("Amount") ?? "0"))}>Partial</Status>
    return <Status color="danger" size="sm" onClick={() => makePayment(id, parseFloat(prompt("Amount") ?? "0"))}>Unpaid</Status>
}
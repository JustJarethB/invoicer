import { TrashIcon } from "@heroicons/react/24/outline";
import * as outline from "@heroicons/react/24/outline";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { Button } from "~/components/home/Button";
import type { LineItem } from "~/components/home/LineItems/LineItemProvider";
import { Status } from "~/components/home/Status";
import { withProvider } from "~/components/home/withProvider";
import type { Address } from "~/data/address";
import { db } from "~/db";
import { useMobile } from "~/hooks";
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
    deleteInvoice: (invoiceID: Invoice['id']) => void;
}
const InvoiceContext = createContext<InvoiceContext>({
    invoices: [],
    makePayment: function (invoiceId: string, amount: number): void {
        throw new Error("Function not implemented.");
    },
    deleteInvoice: function (invoiceId: Invoice['id']): void {
        throw new Error("Function not implemented")
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

    const deleteInvoice = (invoiceId: string) => {
        db.remove(["invoice", invoiceId])
        setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
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
        makePayment,
        deleteInvoice
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
type PaymentStatus = "overpaid" | "paid" | "partial" | "unpaid";
const useInvoicePaymentStatus = (invoiceId: string) => {
    const { payments } = useInvoice(invoiceId)
    const totalDue = useInvoiceTotal(invoiceId)
    // TODO: remove null check once done properly
    const totalPaid = (payments ?? []).map((p) => p.amount).reduce((p, c) => p + c, 0);
    const paymentStatus: PaymentStatus = totalPaid > totalDue ? "overpaid" : (totalPaid > 0 && totalPaid < totalDue) ? "partial" : totalPaid == totalDue ? "paid" : "unpaid"
    return { totalDue, totalPaid, paymentStatus, due: totalDue - totalPaid }
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
    const deleteInvoice = useContext(InvoiceContext).deleteInvoice
    const { totalDue, due, paymentStatus } = useInvoicePaymentStatus(id)
    const [open, setOpen] = useState(false);
    const mobile = useMobile();
    const handleDelete = () => {
        // todo: add confirmation modal
        deleteInvoice(id);
    }
    return (
        <tr className={`px-2 grid grid-cols-subgrid py-4 col-span-full group transition-colors items-center rounded-md ${open ? "bg-white/5 hover:bg-white/6" : "hover:bg-white/5"} ${'cursor-pointer md:pointer-events-none'}`} onClick={() => mobile && setOpen(o => !o)}>
            <td className="flex justify-end gap-2 grid-cols-1">
                <Button icon outline color="danger" size="sm" onClick={() => handleDelete()}>
                    <TrashIcon className="size-5" />
                </Button>
                <Button className="hidden md:block" icon outline size="sm" onClick={() => { setOpen(o => !o) }}>
                    <outline.EyeIcon className="size-5" />
                </Button>
            </td>
            <td className="text-sm">{invoice.id}</td>
            <td className="text-sm">{invoice.date}</td>
            <td className="text-sm">{invoice.purchaseOrder}</td>
            <td className="text-sm">{invoice.to.name}</td>
            <td className="text-sm">£ {totalDue}</td>
            <td className={`text-sm ${paymentStatus == "overpaid" ? "text-amber-700" : ""}`}>£ {due}</td>
            <td className="text-center">
                <PaidStatus id={id} />
            </td>
            {open && (
                <td className="col-start-2 col-span-full pt-4 space-y-2">
                    <span className="visible md:hidden">
                        <p className="text-sm"><strong>PO / Reference:</strong> {invoice.purchaseOrder}</p>
                        <p className="text-sm"><strong>Total Due:</strong> £{totalDue}</p>
                    </span>
                    <p className="text-sm mb-2"><strong>Line items:</strong></p>
                    {invoice.lineItems.map(((item) => (
                        <div key={item.uuid} className="space-x-4 mt-2">
                            <span className="text-md">{item.description}</span>
                            {item.unitPrice && <span className="text-sm">£{item.unitPrice}</span>}
                            {item.type == "2" && <span className="text-sm">qty: {item.qty}</span>}
                        </div>
                    )))}
                </td>
            )}
        </tr>
    )
}
const PaidStatus = ({ id }: { id: string }) => {
    const makePayment = useMakePayment()
    const { paymentStatus } = useInvoicePaymentStatus(id)
    const color = (paymentStatus == "paid") ? "success" : (paymentStatus == "unpaid") ? "danger" : "warning"
    const handleOnClick = () => {
        if (paymentStatus != "paid") makePayment(id, parseFloat(prompt("Amount") ?? "0"))
    }
    return <Status size="sm" onClick={handleOnClick} color={color}>{paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}</Status>
}
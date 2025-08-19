import { useState } from "react";
import { DateInput, ImageInput, TextInput } from "~/components/Inputs";
import { getClients, NULL_CLIENT, type Client } from "~/data/client";
import { Address } from "~/data/address";
import { useLineItems, withLineItemProvider } from "~/components/home/LineItems/LineItemProvider";
import { AddressPanel } from "~/components/home/AddressPanel";
import { Controls } from "~/components/home/Controls";
import { StandardField } from "~/components/home/StandardField";
import { Totals } from "~/components/home/Totals";
import { LineItems } from "~/components/home/LineItems";
import type { Route } from "./+types/invoice";
import { type PaymentDetails } from "~/data/payment";
import { Autosave } from "~/components/home/Autosave";
import { db } from "~/db";
import { ManualSave } from "~/components/home/ManualSave";
import { Container } from "~/components/Container";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Create Invoice" },
    // { name: "description", content: "Welcome to React Router!" },
  ];
}

export async function clientLoader() {
  const from: Address = await db.get(["from-address"]) ?? NULL_CLIENT.address;
  const payment: PaymentDetails = await db.get(["payment-details"]) ?? {}
  const clients: Client[] = await getClients();
  const logo: { url: string } = await db.get(["logo"]) ?? {};
  return { from, payment, clients, logo };
}

export default withLineItemProvider(function Home({ loaderData: { clients, ...loaderData } }: Route.ComponentProps) {
  const [id, setId] = useState<string>(`${(new Date()).getTime()}`.substring(0, 10));
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [purchaseOrder, setPurchaseOrder] = useState<string>('---');
  const [logo, setLogo] = useState(loaderData.logo)
  const [from, setFrom] = useState(loaderData.from)
  const [payment, setPayment] = useState(loaderData.payment);
  const [to, setTo] = useState<Address>(NULL_CLIENT.address);
  const lineItems = useLineItems();
  // TODO: load logo from client
  const placeholder = { url: "//cdn.logo.com/hotlink-ok/enterprise/eid_422203f0-477b-492b-9847-689feab1452a/logo-dark-2020.png" }
  const handleSaveInvoice = async () => {
    const invoice = {
      id,
      date,
      purchaseOrder,
      logo: { url: logo },
      from,
      to,
      lineItems,
      payment

    }
    await db.save(['invoice', id], invoice)
    alert("Invoice Saved") // TODO: show proper toast/notif
  }
  return <div>
    <Controls clients={clients} loadClientAddress={(i) => { setTo(clients[i].address) }} saveInvoice={handleSaveInvoice} />
    <main className="flex items-center justify-center not-print:pt-16 not-print:pb-4">
      <div className="not-print:max-w-[8.3in] not-print:container mx-auto shadow-xl min-h-screen dark:bg-gray-950 bg-gray-50 p-8 print:text-xs print:absolute print:z-50 print:top-0 print:w-full">
        <div className="flex">
          <div className="w-1/2 p-2">
            <Autosave onChange={logo => (setLogo(logo as any))} name="logo">
              <ImageInput className={`rounded ${logo.url ? "" : "print:hidden"}`} name="url" alt="logo" defaultValue={logo.url} placeholder={placeholder.url} style={{ maxHeight: "80px" }} />
            </Autosave>
          </div>
          <div className="w-1/2">
            <div className="p-2">
              <Container>
                <div className="flex items-center">
                  <p className="font-bold px-2 whitespace-nowrap">Invoice Ref</p>
                  <TextInput name="invoiceRef" className="w-full" value={id} onChange={setId} />
                </div>
                <div className="flex items-center">
                  <p className="font-bold px-2 whitespace-nowrap">Tax Date</p>
                  <DateInput name="taxDate" className="w-full" value={date} onChange={setDate} />
                </div>
                <div className="flex items-center">
                  <p className="font-bold px-2 whitespace-nowrap">PO / Reference</p>
                  <TextInput name="purchaseOrder" className="w-full" value={purchaseOrder} onChange={setPurchaseOrder} />
                </div>
              </Container>
            </div>
          </div>
        </div>
        <div className="flex justify-between">
          <div className={` w-full md:w-1/2 p-2`}>
            <Autosave onChange={from => setFrom(from as any)} name="from-address">
              <AddressPanel title='From:' address={from} />
            </Autosave>
          </div>

          <div className={` w-full md:w-1/2 p-2`}>
            <ManualSave onChange={to => setTo(to as any)} name="to-address">
              <AddressPanel title='To:' address={to} />
            </ManualSave>
          </div>
        </div>
        <LineItems />
        <div className="w-full flex">
          <div className="w-2/3">
            <div className="p-2">
              <Autosave onChange={payment => setPayment(payment as any)} name="payment-details">
                <Container>
                  <h2>Payment:</h2>
                  <div className="p-2">
                    <StandardField name="terms" title="Payment Terms" defaultValue={payment.terms} />
                    <StandardField name="sortCode" title="Sort Code" defaultValue={payment.sortCode} />
                    <StandardField name="number" title="Acc. Number" defaultValue={payment.number} />
                    <StandardField name="bankName" title="Bank Name" defaultValue={payment.bankName} />
                    <StandardField name="emailAddress" title="Contact Email" defaultValue={payment.emailAddress} />
                    <StandardField name="phoneNumber" title="Contact Number" defaultValue={payment.phoneNumber} />
                    <StandardField name="info" title="Additional Information" defaultValue={payment.info} />
                  </div>
                </Container>
              </Autosave>
            </div>
          </div>
          <div className="w-1/3">
            <div className="p-2">
              <Totals />
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
})

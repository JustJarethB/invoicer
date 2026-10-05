import { useEffect, useState } from "react";
import { DateInput, ImageInput, TextInput } from "~/components/Inputs";
import { AddressPanel } from "~/components/home/AddressPanel";
import { Autosave } from "~/components/home/Autosave";
import { Container } from "~/components/Container";
import { Controls } from "~/components/home/Controls";
import { fieldFormattingOf, StandardField } from "~/components/home/StandardField";
import { Totals } from "~/components/home/Totals";
import { LineItems } from "~/components/home/LineItems";
import { InvoiceEditorProvider, useInvoiceEditor, useInvoiceEditorOps } from "~/components/home/InvoiceEditorProvider";
import { withLineItemProvider } from "~/components/home/LineItems/LineItemProvider";
import { ManualSave } from "~/components/home/ManualSave";
import { SaveClientModal } from "~/components/home/SaveClientModal";
import { TutorialWizard } from "~/components/TutorialWizard";
import { HelpTooltip } from "~/components/Tooltip";
import { useThemeValue } from "~/components/ThemeSelector";
import { DocumentIcon, TvIcon } from "@heroicons/react/24/outline";
import { type Address, addressFromRecord, AddressSchema, emptyAddress } from "~/data/address";
import { type Client, getClients } from "~/data/client";
import { type Logo, logoFromRecord, LogoSchema } from "~/data/invoice";
import { type PaymentDetails, paymentDetailsFromRecord, PaymentDetailsSchema } from "~/data/payment";
import { db } from "~/db";
import type { Route } from "./+types/invoice";

const saveAddressAsClient = (record: Record<string, string>, close: () => void, onSaved: () => void) => (
  <SaveClientModal record={record} onClose={close} onSaved={onSaved} />
);

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Create Invoice" },
    // { name: "description", content: "Welcome to React Router!" },
  ];
}

export async function clientLoader() {
  const from: Address = (await db.getValidated(AddressSchema, ["from-address"])) ?? emptyAddress();
  const payment: PaymentDetails = (await db.getValidated(PaymentDetailsSchema, ["payment-details"])) ?? paymentDetailsFromRecord({});
  const clients: Client[] = await getClients();
  const logo: Logo | null = await db.getValidated(LogoSchema, ["logo"]);
  return { from, payment, clients, logo };
}

const InvoiceEditor = ({ clients }: { clients: Client[] }) => {
  const editor = useInvoiceEditor();
  const { setDate, setFrom, setId, setLogo, setPayment, setPurchaseOrder, setTo } = useInvoiceEditorOps();
  // TODO: load logo from client
  const placeholder = { url: "//cdn.logo.com/hotlink-ok/enterprise/eid_422203f0-477b-492b-9847-689feab1452a/logo-dark-2020.png" };
  const [paper, setPaper] = useState(false);
  const theme = useThemeValue();
  useEffect(() => {
    const title =
      `Invoice ${editor.id}` +
      (editor.to?.name ? ` - ${editor.to.name}` : "") +
      (editor.purchaseOrder && editor.purchaseOrder !== "---" ? ` (PO: ${editor.purchaseOrder})` : "");
    document.title = title;
  }, [editor.id, editor.to, editor.purchaseOrder]);
  return (
    <div>
      <TutorialWizard />
      <Controls clients={clients} />

      {theme === "dark" && <PreviewOptions paper={paper} onTogglePaper={() => setPaper((prev) => !prev)} />}
      <main data-theme={paper ? "light" : undefined} className="flex items-center justify-center not-print:pt-16 not-print:pb-4 not-print:relative">
        {paper && <p className="text-gray-500 position absolute top-8 text-sm">Print Preview</p>} {/** this absolute positioning is a mess. See line 78 */}
        <div className="not-print:max-w-[8.3in] not-print:container mx-auto shadow-xl min-h-screen dark:bg-gray-950 bg-gray-50 text-gray-800 dark:text-white p-8 print:text-xs print:absolute print:z-50 print:top-0 print:w-full">
          <div className="grid grid-cols-6 gap-4 p-2">
            <div className="col-span-6 md:col-span-3 print:col-span-3">
              <Autosave onChange={(record) => setLogo(logoFromRecord(record))} name="logo">
                <ImageInput
                  className={`rounded ${editor.logo?.url ? "" : "print:hidden"}`}
                  name="url"
                  alt="logo"
                  defaultValue={editor.logo?.url}
                  placeholder={placeholder.url}
                  style={{ maxHeight: "80px" }}
                />
              </Autosave>
            </div>
            <div className="col-span-6 md:col-span-3 print:col-span-3">
              <div className="">
                <Container>
                  <div className="flex items-center">
                    <p className="font-bold px-2 whitespace-nowrap">Invoice Ref</p>
                    <TextInput data-testid="invoice-ref" name="invoiceRef" className="w-full" value={editor.id} onChange={setId} />
                  </div>
                  <div className="flex items-center">
                    <p className="font-bold px-2 whitespace-nowrap">
                      <HelpTooltip tooltip="The legal date of this invoice being served">Tax Date</HelpTooltip>
                    </p>
                    <DateInput data-testid="tax-date" name="taxDate" className="w-full" value={editor.date} onChange={setDate} />
                  </div>
                  <div className="flex items-center">
                    <p className="font-bold px-2 whitespace-nowrap">
                      <HelpTooltip tooltip="If you weren't given a purchase order, leave this blank">PO / Reference</HelpTooltip>
                    </p>
                    <TextInput name="purchaseOrder" className="w-full" value={editor.purchaseOrder} onChange={setPurchaseOrder} />
                  </div>
                </Container>
              </div>
            </div>
            <div className={`col-span-6 md:col-span-3 print:col-span-3`}>
              <Autosave onChange={(record) => setFrom(addressFromRecord(record))} name="from-address">
                <AddressPanel title="From:" address={editor.from} />
              </Autosave>
            </div>

            <div className={`col-span-6 md:col-span-3 print:col-span-3`}>
              <ManualSave onChange={(record) => setTo(addressFromRecord(record))} onSave={saveAddressAsClient}>
                <AddressPanel title="To:" address={editor.to} />
              </ManualSave>
            </div>
            <div className="col-span-6">
              <LineItems />
            </div>
            <div className="col-span-6 md:col-span-4 print:col-span-4">
              <Autosave onChange={(record) => setPayment(paymentDetailsFromRecord(record))} name="payment-details">
                <Container>
                  <h2>Payment:</h2>
                  <div className="p-2">
                    <StandardField name="terms" title="Payment Terms" defaultValue={editor.payment.terms} />
                    <StandardField name="sortCode" title="Sort Code" defaultValue={editor.payment.sortCode} {...fieldFormattingOf("sortCode")} />
                    <StandardField name="number" title="Acc. Number" defaultValue={editor.payment.number} {...fieldFormattingOf("accountNumber")} />
                    <StandardField name="bankName" title="Bank Name" defaultValue={editor.payment.bankName} />
                    <StandardField name="emailAddress" title="Contact Email" defaultValue={editor.payment.emailAddress} />
                    <StandardField name="phoneNumber" title="Contact Number" defaultValue={editor.payment.phoneNumber} />
                    <StandardField name="info" title="Additional Information" defaultValue={editor.payment.info} />
                  </div>
                </Container>
              </Autosave>
            </div>
            <div className="col-span-6 md:col-span-2 print:col-span-2">
              <Totals />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default withLineItemProvider(function Home({ loaderData: { clients, from, logo, payment } }: Route.ComponentProps) {
  return (
    <InvoiceEditorProvider clients={clients} from={from} payment={payment} logo={logo}>
      <InvoiceEditor clients={clients} />
    </InvoiceEditorProvider>
  );
});

const PreviewIcon = ({ icon }: { icon: React.ForwardRefExoticComponent<React.PropsWithoutRef<React.SVGProps<SVGSVGElement>>> }) => {
  const Icon = icon;
  return <Icon className="size-10 py-2 z-50" />;
};

const PreviewOptions = ({ onTogglePaper, paper }: { paper: boolean; onTogglePaper: () => void }) => (
  <button
    className={
      "print:hidden fixed bottom-4 right-4 z-50 flex items-center px-2 gap-2 bg-gray-200 dark:bg-gray-800 border " +
      "before:h-8 before:w-12 before:bg-gray-600 before:absolute before:rounded-full before:transition-transform before:duration-200 before:left-1 before:ease-out " +
      (paper ? "before:translate-x-0" : "before:translate-x-12") +
      " dark:border-gray-700 border-gray-300 rounded-full shadow-lg overflow-hidden cursor-pointer "
    }
    onClick={onTogglePaper}
  >
    <PreviewIcon icon={DocumentIcon} />
    <PreviewIcon icon={TvIcon} />
  </button>
);

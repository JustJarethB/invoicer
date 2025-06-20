import { createContext, PureComponent, useContext, useState, type ComponentPropsWithoutRef, type PropsWithChildren, type ReactNode } from "react";
import type { Route } from "./+types/home";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/16/solid";
import { DateInput, SelectInput, TextInput } from "~/components/Inputs";
import type { Client } from "~/data/client";
import { Address } from "~/data/address";
import { index } from "@react-router/dev/routes";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

const StandardField = ({ title, className, parentClass, ...rest }: ComponentPropsWithoutRef<typeof TextInput> & { title: string, parentClass?: string }) => (
  <div className={`flex justify-between ${parentClass}`}>
    <p className="font-bold px-2">{title}</p>
    <TextInput className={`w-1/2 ${className}`} {...rest} />
  </div>

)
const NULL_CLIENT: Client = {
  id: "",
  contactName: "",
  email: "",
  phone: "",
  address: new Address("", "", "", "", ""),
}
const testFrom: Client = {
  id: "self",
  contactName: "Jareth Bower",
  address: new Address("Abbots Media Limited", "1 Summerhouse Way", "Abbots Langley", "Hertfordshire", "WD5 0DY"),
  email: "",
  phone: "",
}
const stephTo: Client = {
  id: "steph",
  email: "stephportermusic@gmail.com",
  phone: "",
  address: new Address("Steph Porter", "", "", "", ""),
  contactName: "Steph Porter",
}
const agTo: Client = {
  contactName: "Amazing Grace St Thomas LTD",
  id: "ag",
  address: new Address("Amazing Grace St Thomas LTD", "9a St Thomas St", "London", "", "SE1 9RY"),
  email: "accounts@amazinggraceldn.com", // cc tech@amazinggraceldn.com
  phone: "",
}
const nickTo: Client = {
  id: "nick",
  contactName: "Nicholas Anderson",
  address: new Address("N-phonic Limited", "12 Roundmead Close", "Loughton", "Essex", "IG10 1QD"),
  email: "tecknick.anderson@gmail.com",
  phone: "07733749126",
}

const invoice = {
  from: testFrom,
  to: agTo,
  id: `${(new Date()).getTime()}`.substring(0, 10),
  date: (new Date()).toISOString().slice(0, 10),
  logo: { url: "//cdn.logo.com/hotlink-ok/enterprise/eid_422203f0-477b-492b-9847-689feab1452a/logo-dark-2020.png" },
  lineItems: [{
    date: undefined,
    name: undefined,
    description: undefined,
    qty: undefined,
    unitPrice: undefined,
    vatRate: undefined,
    type: "-1",
  }],
  purchaseOrder: '---',
  emailAddress: 'JustJarethB@gmail.com',
  phoneNumber: '(+44)7 414 464 648',
  payment: {
    terms: 'NET 30',
    method: {
      type: 'BACS',
      bankName: `Monzo Bank`,
      sortCode: '04-00-04',
      number: '44200929',
    }
  }
}
const clients = [testFrom, stephTo, agTo, nickTo];

const updateClientAddress = (address: Partial<Address>) => (client: Client) => {
  return {
    ...client,
    address: {
      ...client.address,
      ...address
    }
  }
}

const AddressPanel = ({ address, onChange, className = '', title }: { address: Address, onChange: (change: Partial<Address>) => void, className?: string, title: string }) => (
  <div className={` w-full md:w-1/2 ${className} p-2`}>
    <div className="w-full ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm p-2">
      <h2>{title}</h2>
      <TextInput value={address.name} className=" pb-4 w-full px-2 font-bold" placeholder="Name" onChange={v => onChange({ name: v })} />
      <TextInput value={address.streetAddress} className="w-full px-2 font-bold" placeholder="Street Address" onChange={v => onChange({ streetAddress: v })} />
      <TextInput value={address.city} className="w-full px-2 font-bold" placeholder="City/Town" onChange={v => onChange({ city: v })} />
      <TextInput value={address.county} className="w-full px-2 font-bold" placeholder="County" onChange={v => onChange({ county: v })} />
      <TextInput value={address.postCode} className="w-full px-2 font-bold" placeholder="Postcode" onChange={v => onChange({ postCode: v })} />
    </div>
  </div>
)
const linePrice = ({ qty, unitPrice }: { qty?: number | string, unitPrice?: number | string }) => Number(qty ?? 0) * Number(unitPrice ?? 0);
export default function Home() {
  const [id, setId] = useState<string>(`${(new Date()).getTime()}`.substring(0, 10));
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [purchaseOrder, setPurchaseOrder] = useState<string>('---');
  const [from, setFrom] = useState<Client>(testFrom);
  const [to, setTo] = useState<Client>(NULL_CLIENT);
  const [payment, setPayment] = useState({
    terms: 'NET 30',
    method: {
      type: 'BACS',
      bankName: `Monzo Bank`,
      sortCode: '04-00-04',
      number: '44200929',
    }
  });
  const { emailAddress, logo, phoneNumber, } = invoice

  return <LineItemProvider>
    <div>
      <Controls clients={clients} loadClientAddress={(i) => { setTo(clients[i]) }} saveInvoice={() => { }} />
      <main className="flex items-center justify-center pt-16 pb-4">
        <div className="screen:container mx-auto shadow-xl min-h-screen dark:bg-gray-950 bg-gray-50 p-8 print:text-xs print:absolute print:z-50 print:top-0 print:w-full">
          <div className="flex">
            <div className="w-1/2 p-2"><img alt="logo" src={logo.url} style={{ maxHeight: "80px" }} /></div>
            <div className="w-1/2">
              <div className="p-2">
                <div className="p-2 w-full ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm">
                  <div className="flex items-center">
                    <p className="font-bold px-2 whitespace-nowrap">Invoice Ref</p>
                    <TextInput className="w-full" value={id} onChange={setId} />
                  </div>
                  <div className="flex items-center">
                    <p className="font-bold px-2 whitespace-nowrap">Tax Date</p>
                    <DateInput className="w-full" value={date} onChange={setDate} />
                  </div>
                  <div className="flex items-center">
                    <p className="font-bold px-2 whitespace-nowrap">PO / Reference</p>
                    <TextInput className="w-full" value={purchaseOrder} onChange={setPurchaseOrder} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <AddressPanel title='From:' address={from.address} onChange={d => setFrom(updateClientAddress(d))} />
            <AddressPanel title='To:' address={to.address} onChange={d => setTo(updateClientAddress(d))} />
          </div>
          <LineItems />
          <div className="w-full flex">
            <div className="w-2/3">
              <div className="p-2">
                <div className="p-2 w-full ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm">
                  <h2>Payment:</h2>
                  <div className="p-2">
                    <StandardField title="Payment Terms" defaultValue={payment.terms} />
                    <StandardField title="Sort Code" defaultValue={payment.method.sortCode} />
                    <StandardField title="Acc. Number" defaultValue={payment.method.number} />
                    <StandardField title="Bank Name" defaultValue={payment.method.bankName} />
                    <StandardField title="Contact Email" defaultValue={emailAddress} />
                    <StandardField title="Contact Number" defaultValue={phoneNumber} />
                    {/* <StandardField title="Additional Information" value="Please reference the invoice id during payment" /> */}
                  </div>
                </div>
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
  </LineItemProvider>
    ;
}
const Totals = () => {
  const lineItems = useLineItems();
  const serviceSubTotal = lineItems.filter(item => item.type === "0").map(linePrice).reduce((p, c) => p + c, 0);
  const rentalSubTotal = lineItems.filter(item => item.type === "1").map(linePrice).reduce((p, c) => p + c, 0);
  const expenseSubTotal = lineItems.filter(item => item.type === "2").map(linePrice).reduce((p, c) => p + c, 0);
  const subTotal = serviceSubTotal + rentalSubTotal + expenseSubTotal;
  // const vat = lineItems.map(item => (item.qty * item.unitPrice * item.vatRate) || 0).reduce((p, c) => p + c, 0);
  return (
    <div className="p-2 w-full ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm">
      <h2>Totals:</h2>
      <div className="p-2">
        <StandardField readOnly title="Services" prefix="£" parentClass="text-gray-500" value={formatCurrency(serviceSubTotal)} />
        <StandardField readOnly title="Rental" prefix="£" parentClass="text-gray-500" value={formatCurrency(rentalSubTotal)} />
        <StandardField readOnly title="Expenses" prefix="£" parentClass="text-gray-500" value={formatCurrency(expenseSubTotal)} />
        {/* <StandardField title="VAT" parentClass="text-gray-500" value={formatCurrency(vat)} /> */}
        <hr className="py-2 dark:text-gray-800" />
        {/* <StandardField title="Total" prefix="£" parentClass="" value={formatCurrency(serviceSubTotal + rentalSubTotal + expenseSubTotal)} /> */}
        <StandardField readOnly title="Total" prefix="£" parentClass="" value={formatCurrency(subTotal)} />
      </div>
    </div>

  )
}
type ControlsProps = {
  clients: Client[];
  loadClientAddress: (i: number) => void;
  saveInvoice: () => void;
}
const Controls = ({ clients, loadClientAddress, saveInvoice }: ControlsProps) => (
  <div className="print:hidden sticky top-0 dark:bg-gray-900 bg-gray-50 shadow-sm z-10">
    <div className="container mx-auto">
      <div className="w-full flex justify-end">
        <DropdownButton options={clients.map(c => ({ ...c, key: c.contactName, value: c.contactName }))} onClick={(v, i) => loadClientAddress(i)}>Clients</DropdownButton>
        <Button onClick={() => window.print()}>Print</Button>
        <Button onClick={saveInvoice}>Save</Button>
      </div>
    </div>
  </div>
)
const Button = ({ children, onClick }: ComponentPropsWithoutRef<'button'>) => (
  <div className="p-2">
    <button className="p-2 px-4 rounded-lg hover:bg-gray-600 ring-2 ring-white hover:ring-gray-900 bg-gray-700 text-white font-bold" type="button" onClick={onClick}>{children}</button>
  </div>
)

class DropdownButton extends PureComponent<PropsWithChildren<{ options: { key: string; value: string }[], onClick: (value: string, index: number) => void }>, { open: boolean }> {
  constructor(props: PropsWithChildren<{ options: { key: string; value: string }[], onClick: (value: string, index: number) => void }>) {
    super(props);
    this.state = { open: false };
  }

  handleClick(value: string, index: number) {
    const { onClick } = this.props;
    onClick(value, index);
    this.setState({ open: false })
  }

  render() {
    const { options, children } = this.props;
    const { open } = this.state;
    return (

      <div className="p-2 group">
        <div className='relative'>
          <button className={`p-2 px-4 rounded-t-lg ${open || 'rounded-b-lg'} transition-all group-hover:bg-gray-600 ring-2 ring-white group-hover:ring-gray-900 bg-gray-700 text-white font-bold flex items-center`} type="button" onClick={() => this.setState({ open: !open })}>{children}{open ? <ChevronUpIcon className={"-mr-1 ml-2 h-5 w-5"} /> : <ChevronDownIcon className={"-mr-1 ml-2 h-5 w-5"} />}</button>
          <div className={`absolute bg-gray-700 rounded-b-lg transition-all ring-2 ring-white group-hover:ring-gray-900 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {options.map(({ key, value }, i) => (
              <button key={key} className=' text-white text-xs block w-full justify-center px-2 py-1 hover:bg-gray-600' type="button" value={value} onClick={() => this.handleClick(value, i)}>{key}</button>
            ))}
          </div>
        </div>
      </div>

    )
  }
}
const formatCurrency = (v: number) => Number.isNaN(v) ? "0" : Number(v).toFixed(2);

const lineTypeOptions = [
  { label: '---', value: -1, disabled: true },
  { label: 'Service', value: 0 },
  { label: 'Rental', value: 1 },
  { label: 'Expense', value: 2 }
]

const lineUnitOptions = [
  'Hourly',
  'Daily',
  'Consolidated Items'
]

// const getVatRates = () => ([{ label: "20", value: .2 }, { label: "5", value: .05 }, { label: "N/A", value: 0 }])
const defaultHeaderClasses = "p-2 table-cell font-bold"
const defaultOuterCellClasses = "p-1 table-cell"
const defaultInnerCellClasses = "w-full font-bold"
const LineItems = () => {
  const ids = useLineItemIds();
  return (
    <div className="p-2 table">
      <div className="pb-2 table-row">
        <div className={defaultHeaderClasses}>Service Date</div>
        <div className={`${defaultHeaderClasses} print:hidden`}>Type</div>
        <div className={defaultHeaderClasses}>Ref</div>
        <div className={defaultHeaderClasses}>Unit</div>
        <div className={defaultHeaderClasses}>Quantity</div>
        <div className={defaultHeaderClasses}>Unit Price</div>
        {/* <div className={defaultHeaderClasses}>VAT Rate</div>
                  <div className={defaultHeaderClasses}>VAT</div> */}
        <div className={defaultHeaderClasses}>Total</div>
      </div>
      <div className="ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm table-row-group">
        {/* Need to give key that doesn't change with UserInput, can't use index either */}
        {ids.map((id) => <LineItem id={id} />)}
      </div>
    </div>
  );
}

const ensureFutureCurrency = (v: string) => {
  let result;
  const s = v.toString();
  if (/-/.test(s)) result = "-";
  if (Number.isNaN(parseFloat(v))) return result;
  result = result || "";
  const regRes = s.match(/0*(\d+\.?\d{0,2})/);
  const regMatch = regRes?.[1] || undefined;
  result += regMatch;
  return result;
}

const LineItem = ({ id }: { id: number }) => {
  const item = useLineItem(id);
  const setLineItem = useSetLineItem(id);
  const onChange = <K extends keyof typeof item, V extends typeof item[K]>(change: Partial<Record<K, V>>) => {
    setLineItem({ ...item, ...change });
  }
  // TODO: was moving to unmanaged but need to useState for total value qty*unitPrice
  return (
    <div className={`[&>*:nth-child(odd)]dark:bg-gray-900 [&>*:nth-child(odd)]bg-gray-100 table-row print:text-xs last:print:hidden`}>
      <div className={defaultOuterCellClasses}>
        <DateInput className={defaultInnerCellClasses} defaultValue={item.date} onChange={(v) => onChange({ date: v })} />
      </div>
      <div className={`${defaultOuterCellClasses} print:hidden`}>
        <SelectInput options={lineTypeOptions} className={defaultInnerCellClasses} value={item.type} onChange={(v) => onChange({ type: v as LineItem['type'] })} />
      </div>
      <div className={defaultOuterCellClasses}>
        <TextInput className={defaultInnerCellClasses} value={item.description} onChange={(v) => onChange({ description: v })} />
      </div>
      <div className={defaultOuterCellClasses}>
        <SelectInput options={lineUnitOptions} className={defaultInnerCellClasses} value={item.name} onChange={(v) => onChange({ name: v })} />
      </div>
      <div className={defaultOuterCellClasses}>
        <TextInput className={defaultInnerCellClasses} value={item.qty} onChange={(v) => onChange({ qty: (v) })} />
      </div>
      <div className={defaultOuterCellClasses}>
        <TextInput className={defaultInnerCellClasses} prefix="£" value={(item.unitPrice)} onChange={(v) => onChange({ unitPrice: ensureFutureCurrency(v) })} />
      </div>
      <div className={defaultOuterCellClasses}>
        <TextInput readOnly className={defaultInnerCellClasses} prefix="£" value={formatCurrency(linePrice(item)) || undefined} />
      </div>
    </div>
  );
}
type LineItem = {
  date?: string;
  name?: string;
  description?: string;
  qty?: string;
  unitPrice?: string;
  vatRate?: string;
  type?: "-1" | "0" | "1" | "2";
}
type LineItemContextType = {
  lineItems: LineItem[];
  setLineItems: (lineItems: LineItem[]) => void;
}
const LineItemContext = createContext<LineItemContextType>({
  lineItems: [] as LineItem[],
  setLineItems: function (lineItems: LineItem[]): void {
    throw new Error("Function not implemented.");
  }
})
const LineItemProvider = ({ children }: { children: ReactNode }) => {
  const [lineItems, setLineItems] = useState<LineItem[]>([{
    date: undefined,
    name: "Daily",
    description: "FoH Engineer",
    qty: "1",
    unitPrice: "200",
    vatRate: undefined,
    type: "-1",
  },
  {
    date: undefined,
    name: undefined,
    description: undefined,
    qty: undefined,
    unitPrice: undefined,
    vatRate: undefined,
    type: "-1",
  }
  ])
  return <LineItemContext.Provider value={{ lineItems, setLineItems }}>{children}</LineItemContext.Provider>
}
const useLineItems = () => useContext(LineItemContext).lineItems;
const useLineItemIds = () => useLineItems().map((item, i) => i);
const useLineItem = (index: number) => useLineItems()[index];
const useSetLineItem = (index: number) => {
  const { lineItems, setLineItems } = useContext(LineItemContext);
  return (item: LineItem) => {
    const newLineItems = [...lineItems];
    newLineItems[index] = item;
    setLineItems(newLineItems);
  }
}

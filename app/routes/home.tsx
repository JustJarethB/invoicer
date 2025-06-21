import { useState } from "react";
import { DateInput, TextInput } from "~/components/Inputs";
import { NULL_CLIENT, useLoadClients, useLoadSelf, type Client } from "~/data/client";
import { Address } from "~/data/address";
import { LineItemProvider } from "~/components/home/LineItems/LineItemProvider";
import { AddressPanel } from "~/components/home/AddressPanel";
import { Controls } from "~/components/home/Controls";
import { StandardField } from "~/components/home/StandardField";
import { Totals } from "~/components/home/Totals";
import { LineItems } from "~/components/home/LineItems";
import type { Route } from "./+types/home";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

const updateClientAddress = (address: Partial<Address>) => (client: Client) => {
  return {
    ...client,
    address: {
      ...client.address,
      ...address
    }
  }
}

export default function Home() {
  const me = useLoadSelf()
  const clients = useLoadClients()
  const [id, setId] = useState<string>(`${(new Date()).getTime()}`.substring(0, 10));
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [purchaseOrder, setPurchaseOrder] = useState<string>('---');
  const [from, setFrom] = useState<Client>(me);
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
  const [emailAddress, setEmailAddress] = useState<string>(me.email);
  const [phoneNumber, setPhoneNumber] = useState<string>(me.phone);
  // TODO: load logo from client
  const logo = { url: "//cdn.logo.com/hotlink-ok/enterprise/eid_422203f0-477b-492b-9847-689feab1452a/logo-dark-2020.png" }

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
// export class DropdownButton extends PureComponent<PropsWithChildren<{ options: { key: string; value: string }[], onClick: (value: string, index: number) => void }>, { open: boolean }> {
//   constructor(props: PropsWithChildren<{ options: { key: string; value: string }[], onClick: (value: string, index: number) => void }>) {
//     super(props);
//     this.state = { open: false };
//   }

//   handleClick(value: string, index: number) {
//     const { onClick } = this.props;
//     onClick(value, index);
//     this.setState({ open: false })
//   }

//   render() {
//     const { options, children } = this.props;
//     const { open } = this.state;
//     return (

//       <div className="p-2 group">
//         <div className='relative'>
//           <button className={`p-2 px-4 rounded-t-lg ${open || 'rounded-b-lg'} transition-all group-hover:bg-gray-600 ring-2 ring-white group-hover:ring-gray-900 bg-gray-700 text-white font-bold flex items-center`} type="button" onClick={() => this.setState({ open: !open })}>{children}{open ? <ChevronUpIcon className={"-mr-1 ml-2 h-5 w-5"} /> : <ChevronDownIcon className={"-mr-1 ml-2 h-5 w-5"} />}</button>
//           <div className={`absolute bg-gray-700 rounded-b-lg transition-all ring-2 ring-white group-hover:ring-gray-900 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
//             {options.map(({ key, value }, i) => (
//               <button key={key} className=' text-white text-xs block w-full justify-center px-2 py-1 hover:bg-gray-600' type="button" value={value} onClick={() => this.handleClick(value, i)}>{key}</button>
//             ))}
//           </div>
//         </div>
//       </div>

//     )
//   }
// }


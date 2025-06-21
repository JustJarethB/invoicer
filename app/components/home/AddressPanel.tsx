import { TextInput } from "~/components/Inputs";
import type { Address } from "~/data/address";

export const AddressPanel = ({ address, onChange, className = '', title }: { address: Address; onChange: (change: Partial<Address>) => void; className?: string; title: string; }) => (
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
);

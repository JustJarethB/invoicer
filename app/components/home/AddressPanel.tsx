import { TextInput } from "~/components/Inputs";
import type { Address } from "~/data/address";
import { Container } from "../Container";

export const AddressPanel = ({ address, title }: { address: Address; title: string; }) => (
    <Container>
        <h2>{title}</h2>
        <TextInput name="name" defaultValue={address.name} className=" pb-4 w-full px-2 font-bold" placeholder="Name" />
        <TextInput name="streetAddress" defaultValue={address.streetAddress} className="w-full px-2 font-bold" placeholder="Street Address" />
        <TextInput name="city" defaultValue={address.city} className="w-full px-2 font-bold" placeholder="City/Town" />
        <TextInput name="county" defaultValue={address.county} className="w-full px-2 font-bold" placeholder="County" />
        <TextInput name="postCode" defaultValue={address.postCode} className="w-full px-2 font-bold" placeholder="Postcode" />
    </Container>

);

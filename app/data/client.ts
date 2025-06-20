import type { Address } from "./address";

export type Client = {
    id: string;
    contactName: string;
    email: string;
    phone: string;
    address: Address;
}

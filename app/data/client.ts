import { db } from "~/db";
import { Address } from "./address";

export type Client = {
    id: string;
    contactName: string;
    email: string;
    phone: string;
    address: Address;
}
export const NULL_CLIENT: Client = {
    id: "",
    contactName: "",
    email: "",
    phone: "",
    address: new Address("", "", "", "", ""),
}
// export const useLoadSelf = (): Client => ({
//     id: "self",
//     contactName: "Jareth Bower",
//     address: new Address("Abbots Media Limited", "1 Summerhouse Way", "Abbots Langley", "Hertfordshire", "WD5 0DY"),
//     email: "JustJarethB@gmail.com",
//     phone: "(+44)7 414 464 648",
// })

// export const useLoadClients = (): Client[] => [
//     {
//         id: "steph",
//         email: "stephportermusic@gmail.com",
//         phone: "",
//         address: new Address("Steph Porter", "", "", "", ""),
//         contactName: "Steph Porter",
//     },
//     {
//         contactName: "Amazing Grace St Thomas LTD",
//         id: "ag",
//         address: new Address("Amazing Grace St Thomas LTD", "9a St Thomas St", "London", "", "SE1 9RY"),
//         email: "accounts@amazinggraceldn.com", // cc tech@amazinggraceldn.com
//         phone: "",
//     },
//     {
//         id: "nick",
//         contactName: "Nicholas Anderson",
//         address: new Address("N-phonic Limited", "12 Roundmead Close", "Loughton", "Essex", "IG10 1QD"),
//         email: "tecknick.anderson@gmail.com",
//         phone: "07733749126",
//     }
// ]

export const saveClient = async (key: string, client: Client) => {
    const data = await db.get(['clientKeys']) ?? [];
    db.save(['clients', key], client);
    db.save(['clientKeys'], [...data, key]);
}
export const deleteClient = async (key: string) => {
    const data = await db.get(['clientKeys']) ?? [];
    db.save(['clientKeys'], data.filter((item: string) => item !== key));
    db.remove(['clients', key]);
}

export const getClients = async (): Promise<Client[]> => {
    const keys = await db.get(['clientKeys']) ?? []
    const clients = await Promise.all(keys.map(async (key: string) => {
        return await db.get(['clients', key]) as Client ?? NULL_CLIENT;
    }))
    console.log('Loaded clients:', clients);
    return clients
}
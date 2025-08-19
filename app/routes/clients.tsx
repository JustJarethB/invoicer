import { XMarkIcon } from "@heroicons/react/16/solid";
import { useCallback, useEffect, useState } from "react";
import { Button } from "~/components/home/Button";
import { Modal } from "~/components/Modal";
import { TextInput } from "~/components/Inputs";
import { Address } from "~/data/address";
import { NULL_CLIENT, type Client } from "~/data/client";
import { useDb, db } from "~/db";
import { formJson } from "~/utils/formJson";


const newClient = (): Client => ({ ...NULL_CLIENT, id: `${(new Date()).getTime()}` });
export default () => {
    const db = useDb();
    const [clients, setClients] = useState<Client[]>([])
    const [cacheBuster, setCacheBuster] = useState(0);
    const refreshCache = useCallback(() => {
        setCacheBuster((prev) => prev + 1);
    }, []);
    useEffect(() => {
        const loadClients = async () => {
            const clientsData = await db.getAll(['clients']) as Client[]
            setClients(clientsData);
        }
        loadClients();
    }, [db, setClients, cacheBuster]);
    return <main className="pt-16 pb-4 container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(32%,32%))] justify-center gap-4 p-4">
            {[...clients, newClient()].filter(Boolean).map((client) => (
                <ClientPanel key={client.id} client={client} refreshCache={refreshCache} />
            ))}
        </div>
    </main>
}

const ClientPanel = ({ client, refreshCache }: { client: Client, refreshCache: () => void }) => {
    const db = useDb();
    const saveDB = async (key: string, client: Client) => {
        db.save(['clients', key], client);
    }
    const removeDB = async (key: string) => {
        db.remove(['clients', key]);
        refreshCache();
    }
    const { address } = client;
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const { contactName, phone, email, ...address } = await formJson<Omit<Client, 'address' | "id"> & Client['address']>(e.currentTarget)
        const updatedClient: Client = {
            id: client.id || `${(new Date()).getTime()}`,
            contactName,
            address,
            email,
            phone,
        }
        saveDB(client.id, updatedClient);
        setIsEditing(false);
    }, [client.id])
    return <form onSubmit={onSubmit} className="group p-4 ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm shadow relative " onChange={(e) => { setIsEditing(true); }}>
        <TextInput required name="contactName" className=" text-lg font-bold focus:ring-white" placeholder="Contact Name" defaultValue={client.contactName} />
        <TextInput name="name" placeholder="Name" defaultValue={address?.name} />
        <TextInput name="streetAddress" placeholder="Street Address" defaultValue={address?.streetAddress} />
        <TextInput name="city" placeholder="City/Town" defaultValue={address?.city} />
        <TextInput name="county" placeholder="County" defaultValue={address?.county} />
        <TextInput name="postCode" placeholder="Postcode" defaultValue={address?.postCode} />
        <TextInput name="email" placeholder="Email" defaultValue={client.email} />
        <TextInput name="phone" placeholder="Phone" defaultValue={client.phone} />
        <div className="absolute top-2 right-2 flex justify-end gap-2">
            {isEditing &&
                <Button type="submit" size="sm" color="success">Save</Button>
            }
            <Button icon className="opacity-0 group-hover:opacity-100" title={`Delete ${client.contactName || 'contact'}?`} size="sm" color="danger" onClick={() => setShowDeleteModal(true)}><XMarkIcon className="h-5" /></Button>
        </div>
        {showDeleteModal && <ConfirmDeleteModal onClose={() => setShowDeleteModal(false)} onConfirm={() => {
            removeDB(client.id);
            setShowDeleteModal(false);
        }} />}
    </form>
}

const ConfirmDeleteModal = ({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) => {
    return <Modal title="Delete Client" onClose={onClose}>
        <p className="mb-4">Are you sure you want to delete this client?</p>
        <p className="text-red-500 text-sm">This action cannot be undone.</p>
        <div className="flex justify-end gap-4 pt-4">
            <Button color="secondary" onClick={onClose}>Cancel</Button>
            <Button color="danger" onClick={onConfirm}>Delete</Button>
        </div>
    </Modal>
}
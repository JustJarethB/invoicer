import { XMarkIcon } from "@heroicons/react/16/solid";
import { useCallback, useEffect, useState } from "react";
import { Button } from "~/components/home/Button";
import { Modal } from "~/components/Modal";
import { TextInput } from "~/components/Inputs";
import { type Client, deleteClient, getClients, NULL_CLIENT, saveClient } from "~/data/client";
import { formJson } from "~/utils/formJson";
import { eventBus } from "~/utils/events";
import { formJsonAddress } from "~/data/address";
import { randomUUID } from "~/utils/uuid";

export function meta() {
  return [{ title: "Clients" }];
}

const newClient = (): Client => ({ ...NULL_CLIENT, id: randomUUID() });
export default () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [cacheBuster, setCacheBuster] = useState(0);
  const refreshCache = useCallback(() => {
    setCacheBuster((prev) => prev + 1);
  }, []);
  useEffect(() => {
    const loadClients = async () => {
      try {
        setClients(await getClients());
      } catch (e) {
        // A corrupt stored value crashes db.get's JSON.parse; without this
        // guard the client list silently rendered empty.
        eventBus.publish({
          type: "client.load.failed",
          severity: "warning",
          message: "Saved clients could not be loaded",
          context: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    };
    loadClients();
  }, [setClients, cacheBuster]);
  return (
    <main className="pt-16 pb-4 container mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(32%,32%))] justify-center gap-4 p-4">
        {[...clients, newClient()].filter(Boolean).map((client) => (
          <ClientPanel key={client.id} client={client} refreshCache={refreshCache} />
        ))}
      </div>
    </main>
  );
};

const ClientPanel = ({ client, refreshCache }: { client: Client; refreshCache: () => void }) => {
  const saveDB = async (key: string, client: Client) => {
    try {
      await saveClient(key, client);
      eventBus.publish({ type: "client.saved", severity: "success", message: "Client saved", context: { clientId: key } });
      refreshCache();
    } catch (e) {
      eventBus.publish({
        type: "client.failed",
        severity: "error",
        message: "Client could not be saved",
        context: { clientId: key, error: e instanceof Error ? e.message : String(e) },
      });
    }
  };
  const removeDB = async (key: string) => {
    try {
      await deleteClient(key);
      eventBus.publish({ type: "client.deleted", severity: "success", message: "Client deleted", context: { clientId: key } });
      refreshCache();
    } catch (e) {
      eventBus.publish({
        type: "client.delete.failed",
        severity: "error",
        message: "Client could not be deleted",
        context: { clientId: key, error: e instanceof Error ? e.message : String(e) },
      });
    }
  };
  const { address } = client;
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const { contactName, email, phone } = await formJson<Pick<Client, "contactName" | "phone" | "email">>(e.currentTarget);
      const address = formJsonAddress(e.currentTarget);
      const updatedClient: Client = {
        id: client.id || randomUUID(),
        contactName,
        address,
        email,
        phone,
      };
      saveDB(client.id, updatedClient);
      setIsEditing(false);
    },
    [client.id]
  );
  return (
    <form
      onSubmit={onSubmit}
      className="group p-4 ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm shadow relative "
      onChange={(_e) => {
        setIsEditing(true);
      }}
    >
      <TextInput required name="contactName" className=" text-lg font-bold focus:ring-white" placeholder="Contact Name" defaultValue={client.contactName} />
      <TextInput name="name" placeholder="Name" defaultValue={address?.name} />
      <TextInput name="streetAddress" placeholder="Street Address" defaultValue={address?.streetAddress} />
      <TextInput name="city" placeholder="City/Town" defaultValue={address?.city} />
      <TextInput name="county" placeholder="County" defaultValue={address?.county} />
      <TextInput name="postCode" placeholder="Postcode" defaultValue={address?.postCode} />
      <TextInput name="email" placeholder="Email" defaultValue={client.email} />
      <TextInput name="phone" placeholder="Phone" defaultValue={client.phone} />
      <div className="absolute top-2 right-2 flex justify-end gap-2">
        {isEditing && (
          <Button type="submit" size="sm" color="success">
            Save
          </Button>
        )}
        <Button
          icon
          className="opacity-0 group-hover:opacity-100"
          title={`Delete ${client.contactName || "contact"}?`}
          size="sm"
          color="danger"
          onClick={() => setShowDeleteModal(true)}
        >
          <XMarkIcon className="h-5" />
        </Button>
      </div>
      {showDeleteModal && (
        <ConfirmDeleteModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => {
            removeDB(client.id);
            setShowDeleteModal(false);
          }}
        />
      )}
    </form>
  );
};

const ConfirmDeleteModal = ({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) => {
  return (
    <Modal title="Delete Client" onClose={onClose}>
      <p className="mb-4">Are you sure you want to delete this client?</p>
      <p className="text-red-500 text-sm">This action cannot be undone.</p>
      <div className="flex justify-end gap-4 pt-4">
        <Button color="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button color="danger" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </Modal>
  );
};

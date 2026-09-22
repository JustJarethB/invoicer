import { useRef } from "react";
import { Modal } from "../Modal";
import { AddressPanel } from "./AddressPanel";
import { TextInput } from "../Inputs";
import { Button } from "./Button";
import { type Client, saveClient } from "~/data/client";
import { addressFromRecord, formJsonAddress } from "~/data/address";
import { formJson } from "~/utils/formJson";
import { randomUUID } from "~/utils/uuid";
import { eventBus, rethrowError } from "~/utils/events";

/**
 * "Save this address as a client" confirmation. Gathers the extra field a
 * Client needs beyond an Address (contactName), pre-fills the captured address,
 * and persists a new client. This belongs to the client domain, not to
 * ManualSave — ManualSave only hands it the form record.
 */
export const SaveClientModal = ({ onClose, onSaved, record }: { record: Record<string, string>; onClose: () => void; onSaved: () => void }) => {
  const formMetaRef = useRef<HTMLFormElement>(null);
  const formAddressRef = useRef<HTMLFormElement>(null);
  const address = addressFromRecord(record);

  const save = async () => {
    try {
      if (!formMetaRef.current) throw new Error("SaveClientModal: form ref is not attached");
      const id = randomUUID();
      const client: Client = {
        id,
        ...(await formJson<Pick<Client, "contactName">>(formMetaRef.current)),
        address: formAddressRef.current ? formJsonAddress(formAddressRef.current) : address,
        email: "",
        phone: "",
      };
      await saveClient(id, client);
      eventBus.publish({ type: "client", severity: "success", message: "Client saved", context: { clientId: id, action: "saved" } });
      onSaved();
      onClose();
    } catch (e) {
      // Fire-and-forget caller (modal Save button): rethrows to the global rejection catcher, which sees this value already published (exactly-once).
      rethrowError(eventBus, { type: "client", message: "Client could not be saved", context: { action: "failed" } }, e);
    }
  };

  return (
    <Modal onClose={onClose} title="Save Client">
      <form ref={formMetaRef}>
        <TextInput name="contactName" className="font-bold text-xl" placeholder="Display Name" />
      </form>
      <form ref={formAddressRef}>
        <AddressPanel title="" address={address} />
      </form>
      <div className="flex items-center justify-between">
        <Button color="secondary" className="mt-4" onClick={onClose}>
          Cancel
        </Button>
        <Button color="primary" className="mt-4" onClick={save}>
          Save
        </Button>
      </div>
    </Modal>
  );
};

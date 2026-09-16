import { useRef, useState } from "react";
import { Modal } from "../Modal";
import { AddressPanel } from "./AddressPanel";
import { TextInput } from "../Inputs";
import { Button } from "./Button";
import { type Client, saveClient } from "~/data/client";
import { addressFromRecord, emptyAddress, formJsonAddress } from "~/data/address";
import { formJson } from "~/utils/formJson";
import { parseClientNameForm } from "~/data/schemas";
import { randomUUID } from "~/utils/uuid";

/**
 * "Save this address as a client" confirmation. Gathers the extra field a
 * Client needs beyond an Address (contactName), pre-fills the captured address,
 * and persists a new client. This belongs to the client domain, not to
 * ManualSave — ManualSave only hands it the form record.
 */
export const SaveClientModal = ({ onClose, onSaved, record }: { record: Record<string, string>; onClose: () => void; onSaved: () => void }) => {
  const formMetaRef = useRef<HTMLFormElement>(null);
  const formAddressRef = useRef<HTMLFormElement>(null);
  // ManualSave only passes on fields the To-panel rendered; addressSchema
  // DEFAULTS the fields a record is missing, so a partial record pre-fills
  // with "" rather than being rejected — the fallback is the empty address.
  const address = addressFromRecord(record) ?? emptyAddress();
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveDisabled, setSaveDisabled] = useState(false);

  const save = async () => {
    if (!formMetaRef.current) throw new Error("SaveClientModal: form ref is not attached");
    const parsed = parseClientNameForm(await formJson(formMetaRef.current));
    if (!parsed.success) {
      // User-visible outcome, not a dead throw: an empty display name is a
      // recoverable input error, so the modal stays open with a message.
      setNameError("Enter a display name to save this client.");
      return;
    }
    const id = randomUUID();
    const client: Client = {
      id,
      ...parsed.data,
      address: formAddressRef.current ? formJsonAddress(formAddressRef.current) : address,
      email: "",
      phone: "",
    };
    setSaveDisabled(true);
    try {
      await saveClient(id, client);
    } finally {
      setSaveDisabled(false);
    }
    onSaved();
    onClose();
  };

  return (
    <Modal onClose={onClose} title="Save Client">
      <form ref={formMetaRef}>
        <TextInput name="contactName" className="font-bold text-xl" placeholder="Display Name" onChange={() => setNameError(null)} />
      </form>
      <form ref={formAddressRef}>
        <AddressPanel title="" address={address} />
      </form>
      {nameError && <p className="mt-2 text-sm text-red-500">{nameError}</p>}
      <div className="flex items-center justify-between">
        <Button color="secondary" className="mt-4" onClick={onClose}>
          Cancel
        </Button>
        <Button color="primary" className="mt-4" onClick={save} disabled={saveDisabled}>
          Save
        </Button>
      </div>
    </Modal>
  );
};

import { ArrowPathRoundedSquareIcon } from "@heroicons/react/16/solid";
import { useRef, useState, type PropsWithChildren } from "react";
import { Tooltip } from "../Tooltip";
import { Modal } from "./Modal";
import { AddressPanel } from "./AddressPanel";
import { TextInput } from "../Inputs";
import type { Address } from "~/data/address";
import { Button } from "./Button";
import { saveClient, type Client } from "~/data/client";
import { formJson } from "../../utils/formJson";
type Props = {
    name: string;
    hideIcon?: boolean;
    onChange?: ((newState: Record<string, string>) => void)
}
export const ManualSave = <T,>({ children, name, hideIcon, onChange: onChangeParent }: PropsWithChildren<Props>) => {
    const formRef = useRef<HTMLFormElement>(null);
    const [isStale, setIsStale] = useState(false);
    const [saveData, setSaveData] = useState<Address | null>(null);
    const onChange = async () => {
        setIsStale(true);
        onChangeParent?.(await formJson(formRef.current as HTMLFormElement));
    };
    const onSave = async () => {
        if (!formRef.current) throw new Error("Form reference is not set");
        const data = formJson<Address>(formRef.current);
        setSaveData(data as unknown as Address);
        console.log("Saving data", data);
        // await db.save([name], data)
    }
    return (
        <form ref={formRef} onChange={onChange} className="relative">
            <span className={`${hideIcon && "hidden"} absolute top-1 right-1 print:hidden`}>
                <Tooltip title="Save these values for later" >
                    <ArrowPathRoundedSquareIcon onClick={onSave} className={`${isStale ? "text-amber-400" : "text-blue-400 rotate-180 opacity-50"} transition-all duration-300 h-5 w-5 cursor-pointer`} />
                </Tooltip>
            </span>
            {children}
            {saveData && (
                <ClientModal data={saveData} onClose={() => setSaveData(null)} />
            )}
        </form>
    );
}
const ClientModal = ({ data, onClose }: { data: Address; onClose: () => void }) => {
    const formMetaRef = useRef<HTMLFormElement>(null);
    const formAddressRef = useRef<HTMLFormElement>(null);

    return (
        <Modal onClose={onClose} title="Save Client">
            <form ref={formMetaRef}>
                <TextInput name="contactName" className="font-bold text-xl" placeholder="Display Name" />
            </form>
            <form ref={formAddressRef}>
                <AddressPanel title="" onChange={() => { }} address={data} />
            </form>
            <div className="flex items-center justify-between">
                <Button color="secondary" className="mt-4" onClick={onClose}>Cancel</Button>
                <Button color="primary" className="mt-4" onClick={async () => {
                    const saveData: Client = {
                        id: `${(new Date()).getTime()}`,
                        ...(await formJson<Pick<Client, 'contactName'>>(formMetaRef.current as HTMLFormElement)),
                        address: await formJson<Address>(formAddressRef.current as HTMLFormElement),
                        email: "",
                        phone: "",
                    }
                    await saveClient(`${(new Date()).getTime()}`, saveData);
                    onClose();
                }}>Save</Button>
            </div>
        </Modal>
    );
};
import type { Client } from "~/data/client";
import { DropdownButton } from "./DropdownButton";
import { Button } from "./Button";

export type ControlsProps = {
    clients: Client[];
    loadClientAddress: (i: number) => void;
    saveInvoice: () => void;
}

export const Controls = ({ clients, loadClientAddress, saveInvoice }: ControlsProps) => (
    <div className="print:hidden sticky top-0 dark:bg-gray-900 bg-gray-50 shadow-sm z-10">
        <div className="container mx-auto">
            <div className="w-full flex justify-end">
                <DropdownButton options={clients.map(c => ({ ...c, key: c.contactName, value: c.contactName }))} onClick={(v, i) => loadClientAddress(i)}>Clients</DropdownButton>
                <Button onClick={() => window.print()}>Print</Button>
                <Button onClick={saveInvoice}>Save</Button>
            </div>
        </div>
    </div>
);

import type { Client } from "~/data/client";
import { DropdownButton } from "./DropdownButton";
import { Button } from "./Button";

export type ControlsProps = {
  clients: Client[];
  /** Receives the chosen client's id, not a positional index (audit C2). */
  loadClientAddress: (clientId: string) => void;
  saveInvoice: () => void;
};

export const Controls = ({ clients, loadClientAddress, saveInvoice }: ControlsProps) => (
  <div className="print:hidden sticky top-0 dark:bg-gray-900 bg-gray-50 shadow-sm z-10">
    <div className="container mx-auto">
      <div className="w-full flex gap-2 py-2 justify-end">
        <DropdownButton options={clients.map((c) => ({ ...c, key: c.contactName, value: c.id }))} onClick={(value) => loadClientAddress(value)}>
          Clients
        </DropdownButton>
        <Button onClick={() => window.print()}>Print</Button>
        <Button onClick={saveInvoice}>Save</Button>
      </div>
    </div>
  </div>
);

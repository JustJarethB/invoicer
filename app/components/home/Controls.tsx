import type { Client } from "~/data/client";
import { memo } from "react";
import { useInvoiceDraftOps } from "./InvoiceDraftProvider";
import { DropdownButton } from "./DropdownButton";
import { Button } from "./Button";

export type ControlsProps = {
  clients: Client[];
};

/**
 * Presentation-only: draft values and operations arrive through hooks, clients
 * stays a prop. memo keeps Controls from re-rendering while the editors'
 * draft keystrokes flow through the value context.
 */
export const Controls = memo(function Controls({ clients }: ControlsProps) {
  const { loadClientAddress, saveInvoice } = useInvoiceDraftOps();
  return (
    <div className="print:hidden sticky top-0 dark:bg-gray-900 bg-gray-50 shadow-sm z-10">
      <div className="container mx-auto">
        <div className="w-full flex gap-2 py-2 justify-end">
          <DropdownButton options={clients.map((c) => ({ ...c, key: c.contactName, value: c.id }))} onClick={loadClientAddress}>
            Clients
          </DropdownButton>
          <Button onClick={() => window.print()}>Print</Button>
          <Button onClick={saveInvoice}>Save</Button>
        </div>
      </div>
    </div>
  );
});

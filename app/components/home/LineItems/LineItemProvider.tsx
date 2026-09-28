import { createContext, type ReactNode, useContext, useState } from "react";
import { randomUUID } from "~/utils/uuid";
import type { LineItem } from "~/data/invoice";

export type { LineItem };

type LineItemContextType = {
  lineItems: LineItem[];
  setLineItems: (lineItems: LineItem[]) => void;
};
const LineItemContext = createContext<LineItemContextType>({
  lineItems: [] as LineItem[],
  setLineItems: function (): void {
    throw new Error("Function not implemented.");
  },
});

const newLineItem = (): LineItem => ({
  date: undefined,
  description: undefined,
  name: undefined,
  qty: undefined,
  type: undefined,
  unitPrice: undefined,
  uuid: randomUUID(),
  vatRate: undefined,
});

export const LineItemProvider = ({ children, initialLineItems }: { children: ReactNode; initialLineItems?: LineItem[] }) => {
  const [lineItems, setLineItems] = useState<LineItem[]>(() => (initialLineItems?.length ? initialLineItems : [newLineItem()]));
  return <LineItemContext.Provider value={{ lineItems, setLineItems }}>{children}</LineItemContext.Provider>;
};
export const useLineItems = () => useContext(LineItemContext).lineItems;
export const useLineItemIds = () => useLineItems().map((item) => item.uuid);
export const useLineItem = (id: string) => useLineItems().find((item) => item.uuid === id);
export const useSetLineItem = (id: string) => {
  const { lineItems, setLineItems } = useContext(LineItemContext);
  return (item: LineItem) => {
    const index = lineItems.findIndex((lineItem) => lineItem.uuid === id);
    // A stale id (row deleted mid-edit) must not write to index -1, which
    // would create a phantom "-1" member on the saved invoice (audit C1).
    if (index === -1) return;
    const newLineItems = [...lineItems];
    newLineItems[index] = item;
    if (index === newLineItems.length - 1) {
      newLineItems.push(newLineItem());
    }
    setLineItems(newLineItems);
  };
};
export const useDeleteLineItem = (id: string) => {
  const { lineItems, setLineItems } = useContext(LineItemContext);
  return () => {
    const newLineItems = lineItems.filter((item) => item.uuid !== id);
    setLineItems(newLineItems);
  };
};
export const withLineItemProvider = <P extends object>(Component: React.ComponentType<P>) => {
  return function WrappedComponent(props: P) {
    return (
      <LineItemProvider>
        <Component {...props} />
      </LineItemProvider>
    );
  };
};

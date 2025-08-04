import { createContext, type ReactNode, useState, useContext, type PropsWithChildren } from "react";
import { withProvider } from "../withProvider";
import { randomUUID } from "~/utils/uuid";
import type { chargeTypes } from "./LineItem";

export type LineItem = {
    uuid: string;
    date?: string;
    name?: string;
    description?: string;
    unit?: string;
    qty?: string;
    unitPrice?: string;
    vatRate?: string;
    type?: "-1" | typeof chargeTypes[number]["id"];
};
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
    uuid: randomUUID(),
    date: undefined,
    name: undefined,
    description: undefined,
    qty: undefined,
    unitPrice: undefined,
    vatRate: undefined,
    type: undefined,
});

export const LineItemProvider = ({ children }: { children: ReactNode; }) => {
    const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
    return <LineItemContext.Provider value={{ lineItems, setLineItems }}>{children}</LineItemContext.Provider>;
};
export const useLineItems = () => useContext(LineItemContext).lineItems;
export const useLineItemIds = () => useLineItems().map((item) => item.uuid);
export const useLineItem = (id: string) => useLineItems().find((item) => item.uuid === id)
export const useSetLineItem = (id: string) => {
    const { lineItems, setLineItems } = useContext(LineItemContext);
    return (item: LineItem) => {
        const newLineItems = [...lineItems];
        const index = newLineItems.findIndex((lineItem) => lineItem.uuid === id);
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
}
export const withLineItemProvider = withProvider(LineItemProvider);
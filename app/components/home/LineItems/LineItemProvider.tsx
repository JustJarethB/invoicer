import { createContext, type ReactNode, useState, useContext } from "react";

export type LineItem = {
    date?: string;
    name?: string;
    description?: string;
    qty?: string;
    unitPrice?: string;
    vatRate?: string;
    type?: "-1" | "0" | "1" | "2";
};
type LineItemContextType = {
    lineItems: LineItem[];
    setLineItems: (lineItems: LineItem[]) => void;
};
const LineItemContext = createContext<LineItemContextType>({
    lineItems: [] as LineItem[],
    setLineItems: function (): void {
        throw new Error("Function not implemented.");
    }
});
export const LineItemProvider = ({ children }: { children: ReactNode; }) => {
    const [lineItems, setLineItems] = useState<LineItem[]>([{
        date: undefined,
        name: "Daily",
        description: "FoH Engineer",
        qty: "1",
        unitPrice: "200",
        vatRate: undefined,
        type: "-1",
    },
    {
        date: undefined,
        name: undefined,
        description: undefined,
        qty: undefined,
        unitPrice: undefined,
        vatRate: undefined,
        type: "-1",
    }
    ]);
    return <LineItemContext.Provider value={{ lineItems, setLineItems }}>{children}</LineItemContext.Provider>;
};
export const useLineItems = () => useContext(LineItemContext).lineItems;
export const useLineItemIds = () => useLineItems().map((item, i) => i);
export const useLineItem = (index: number) => useLineItems()[index];
export const useSetLineItem = (index: number) => {
    const { lineItems, setLineItems } = useContext(LineItemContext);
    return (item: LineItem) => {
        const newLineItems = [...lineItems];
        newLineItems[index] = item;
        setLineItems(newLineItems);
    };
};

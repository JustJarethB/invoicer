import { StandardField } from "~/components/home/StandardField";
import { formatCurrency } from "../../utils/formatCurrency";
import { linePrice } from "../../utils/linePrice";
import { useLineItems } from "./LineItems/LineItemProvider";
import { chargeTypes } from "./LineItems/LineItem";

export const Totals = () => {
    const lineItems = useLineItems();
    const subTotal = lineItems.map(linePrice).reduce((p, c) => p + c, 0);
    // const vat = lineItems.map(item => (item.qty * item.unitPrice * item.vatRate) || 0).reduce((p, c) => p + c, 0);
    return (
        <div className="p-2 w-full ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm">
            <h2>Totals:</h2>
            <div className="p-2">
                {
                    chargeTypes.map(({ id, label }) => {
                        const subTotal = lineItems.filter(item => item.type === id).map(linePrice).reduce((p, c) => p + c, 0);
                        if (subTotal === 0) return null; // Skip if no items of this type
                        return <StandardField inputClassName="text-right" readOnly title={`${label}s`} prefix="£" parentClass="text-gray-500" value={formatCurrency(subTotal)} />
                    })
                }
                {/* <StandardField title="VAT" parentClass="text-gray-500" value={formatCurrency(vat)} /> */}
                <hr className="py-2 dark:text-gray-800" />
                <StandardField className="print:font-bold" inputClassName="text-right" readOnly title="Total" prefix="£" parentClass="" value={formatCurrency(subTotal)} />
            </div>
        </div>

    );
};

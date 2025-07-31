import { StandardField } from "~/components/home/StandardField";
import { formatCurrency } from "../../utils/formatCurrency";
import { linePrice } from "../../utils/linePrice";
import { useLineItems } from "./LineItems/LineItemProvider";

export const Totals = () => {
    const lineItems = useLineItems();
    const serviceSubTotal = lineItems.filter(item => item.type === "0").map(linePrice).reduce((p, c) => p + c, 0);
    const rentalSubTotal = lineItems.filter(item => item.type === "1").map(linePrice).reduce((p, c) => p + c, 0);
    const expenseSubTotal = lineItems.filter(item => item.type === "2").map(linePrice).reduce((p, c) => p + c, 0);
    const subTotal = serviceSubTotal + rentalSubTotal + expenseSubTotal;
    // const vat = lineItems.map(item => (item.qty * item.unitPrice * item.vatRate) || 0).reduce((p, c) => p + c, 0);
    return (
        <div className="p-2 w-full ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm">
            <h2>Totals:</h2>
            <div className="p-2">
                <StandardField inputClassName="text-right" readOnly title="Services" prefix="£" parentClass="text-gray-500" value={formatCurrency(serviceSubTotal)} />
                <StandardField inputClassName="text-right" readOnly title="Rental" prefix="£" parentClass="text-gray-500" value={formatCurrency(rentalSubTotal)} />
                <StandardField inputClassName="text-right" readOnly title="Expenses" prefix="£" parentClass="text-gray-500" value={formatCurrency(expenseSubTotal)} />
                {/* <StandardField title="VAT" parentClass="text-gray-500" value={formatCurrency(vat)} /> */}
                <hr className="py-2 dark:text-gray-800" />
                {/* <StandardField title="Total" prefix="£" parentClass="" value={formatCurrency(serviceSubTotal + rentalSubTotal + expenseSubTotal)} /> */}
                <StandardField className="print:font-bold" inputClassName="text-right" readOnly title="Total" prefix="£" parentClass="" value={formatCurrency(subTotal)} />
            </div>
        </div>

    );
};

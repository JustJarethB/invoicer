import { StandardField } from "~/components/home/StandardField";
import { formatCurrency } from "../../utils/formatCurrency";
import { linePrice } from "../../utils/linePrice";
import { useLineItems } from "./LineItems/LineItemProvider";
import { chargeTypes } from "./LineItems/LineItem";
import { Container } from "../Container";

export const Totals = () => {
    const lineItems = useLineItems();
    const subTotal = lineItems.map(linePrice).reduce((p, c) => p + c, 0);
    // const vat = lineItems.map(item => (item.qty * item.unitPrice * item.vatRate) || 0).reduce((p, c) => p + c, 0);
    return (
        <Container className="flex flex-col h-full w-full">
            <h2>Totals:</h2>
            <div className="p-2 h-full flex flex-col justify-between">
                <div>
                    {
                        chargeTypes.map(({ id, label }) => {
                            const subTotal = lineItems.filter(item => item.type === id).map(linePrice).reduce((p, c) => p + c, 0);
                            if (subTotal === 0) return null; // Skip if no items of this type
                            return <StandardField inputClassName="text-right" readOnly title={`${label}s`} prefix="£" parentClass="text-gray-500" value={formatCurrency(subTotal)} />
                        })
                    }
                </div>
                {/* <StandardField title="VAT" parentClass="text-gray-500" value={formatCurrency(vat)} /> */}
                <div className="">
                    <hr className="py-2 dark:text-gray-800" />
                    <StandardField className="print:font-bold" inputClassName="text-right" readOnly title="Total" prefix="£" parentClass="" value={formatCurrency(subTotal)} />
                </div>
            </div>
        </Container>

    );
};

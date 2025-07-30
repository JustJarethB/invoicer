import { LineItem } from "./LineItem";
import { useLineItemIds } from "./LineItemProvider";
const defaultHeaderClasses = "p-2 table-cell font-bold"
export const LineItems = () => {
    const ids = useLineItemIds();
    return (
        <div className="p-2 table">
            <div className="pb-2 table-row">
                <div className={defaultHeaderClasses}>Service Date</div>
                <div className={`${defaultHeaderClasses} print:hidden`}>Type</div>
                <div className={defaultHeaderClasses}>Ref</div>
                <div className={defaultHeaderClasses}>Unit</div>
                <div className={defaultHeaderClasses}>Quantity</div>
                <div className={defaultHeaderClasses}>Unit Price</div>
                {/* <div className={defaultHeaderClasses}>VAT Rate</div>
                      <div className={defaultHeaderClasses}>VAT</div> */}
                <div className={defaultHeaderClasses}>Total</div>
            </div>
            <div className="ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm table-row-group">
                {/* Need to give key that doesn't change with UserInput, can't use index either */}
                {ids.map((id) => <LineItem key={id} id={id} />)}
            </div>
        </div>
    );
};


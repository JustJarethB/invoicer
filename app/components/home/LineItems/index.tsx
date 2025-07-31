import { HelpTooltip } from "~/components/Tooltip";
import { LineItem } from "./LineItem";
import { useLineItemIds } from "./LineItemProvider";
const defaultHeaderClasses = "p-2 font-bold"
export const LineItems = () => {
    const ids = useLineItemIds();
    return (
        <div className="p-2 grid grid-cols-[auto_5.2rem_auto_4.2rem_4rem_5.5rem_8rem] print:grid-cols-[auto_auto_4.5rem_4.5rem_5rem_auto]">
            <div className="pb-2 grid grid-cols-subgrid col-span-full">
                <div className={`${defaultHeaderClasses}`}>Service Date</div>
                <div className={`${defaultHeaderClasses} print:hidden`}>Type</div>
                <div className={defaultHeaderClasses}>Reference</div>
                <div className={defaultHeaderClasses}>Unit</div>
                <div className={defaultHeaderClasses}>Qty</div>
                <div className={`text-right ${defaultHeaderClasses}`}><HelpTooltip tooltip="Price per unit">Each</HelpTooltip></div>
                {/* <div className={defaultHeaderClasses}>VAT Rate</div>
                      <div className={defaultHeaderClasses}>VAT</div> */}
                <div className={`text-right ${defaultHeaderClasses}`}>Total</div>
            </div>
            <div className="ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm grid grid-cols-subgrid col-span-full">
                {/* Need to give key that doesn't change with UserInput, can't use index either */}
                {ids.map((id) => <LineItem key={id} id={id} />)}
            </div>
        </div>
    );
};


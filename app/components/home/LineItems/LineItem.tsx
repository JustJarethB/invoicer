import { DateInput, SelectInput, TextInput } from "~/components/Inputs";
import { ensureFutureCurrency } from "../../../utils/ensureFutureCurrency";
import { linePrice } from "../../../utils/linePrice";
import { useLineItem, useSetLineItem, type LineItem as LineItemType } from "./LineItemProvider";
import { formatCurrency } from "../../../utils/formatCurrency";
const defaultOuterCellClasses = "p-1 table-cell"
const defaultInnerCellClasses = "w-full font-bold"
const lineTypeOptions = [
    { label: 'Service', value: 0 },
    { label: 'Rental', value: 1 },
    { label: 'Expense', value: 2 }
]
const lineUnitOptions = [
    'Hourly',
    'Daily',
    'Consolidated Items'
]
export const LineItem = ({ id }: { id: number; }) => {
    const item = useLineItem(id);
    const setLineItem = useSetLineItem(id);
    const onChange = <K extends keyof typeof item, V extends (typeof item)[K]>(change: Partial<Record<K, V>>) => {
        setLineItem({ ...item, ...change });
    };
    // TODO: was moving to unmanaged but need to useState for total value qty*unitPrice
    return (
        <div className={`[&>*:nth-child(odd)]dark:bg-gray-900 [&>*:nth-child(odd)]bg-gray-100 table-row print:text-xs last:print:hidden`}>
            <div className={defaultOuterCellClasses}>
                <DateInput className={defaultInnerCellClasses} defaultValue={item.date} onChange={(v) => onChange({ date: v })} />
            </div>
            <div className={`${defaultOuterCellClasses} print:hidden`}>
                <SelectInput options={lineTypeOptions} className={defaultInnerCellClasses} value={item.type} onChange={(v) => onChange({ type: v as LineItemType['type'] })} />
            </div>
            <div className={defaultOuterCellClasses}>
                <TextInput className={defaultInnerCellClasses} value={item.description} onChange={(v) => onChange({ description: v })} />
            </div>
            <div className={defaultOuterCellClasses}>
                <SelectInput options={lineUnitOptions} className={defaultInnerCellClasses} value={item.name} onChange={(v) => onChange({ name: v })} />
            </div>
            <div className={defaultOuterCellClasses}>
                <TextInput className={defaultInnerCellClasses} value={item.qty} onChange={(v) => onChange({ qty: (v) })} />
            </div>
            <div className={defaultOuterCellClasses}>
                <TextInput className={defaultInnerCellClasses} prefix="£" value={(item.unitPrice)} onChange={(v) => onChange({ unitPrice: ensureFutureCurrency(v) })} />
            </div>
            <div className={defaultOuterCellClasses}>
                <TextInput readOnly className={defaultInnerCellClasses} prefix="£" value={formatCurrency(linePrice(item)) || undefined} />
            </div>
        </div>
    );
};

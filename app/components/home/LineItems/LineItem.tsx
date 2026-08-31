import { DateInput, SelectInput, TextInput } from "~/components/Inputs";
import { parseCurrency } from "~/utils/parseCurrency";
import { chargeTypes, linePrice, type LineItem as LineItemType } from "~/data/invoice";
import { useDeleteLineItem, useLineItem, useSetLineItem } from "./LineItemProvider";
import { formatCurrency } from "~/utils/formatCurrency";
import { Button } from "../Button";
import { XMarkIcon } from "@heroicons/react/24/outline";
const defaultOuterCellClasses = "p-1";
const defaultInnerCellClasses = "w-full not-print:font-bold";

const lineTypeOptions = chargeTypes.map((type) => ({
  label: type.label,
  value: type.id,
}));

const lineUnitOptions = ["Hourly", "Daily", "Items"];
export const LineItem = ({ id }: { id: string }) => {
  const item = useLineItem(id);
  if (!item) {
    throw new Error(`LineItem with id ${id} not found`);
  }
  const setLineItem = useSetLineItem(id);
  const deleteLineItem = useDeleteLineItem(id);
  const onChange = <K extends keyof typeof item, V extends (typeof item)[K]>(change: Partial<Record<K, V>>) => {
    setLineItem({ ...item, ...change });
  };
  const chargeType = chargeTypes.find((type) => type.id === item.type);
  const date = item.date ?? new Date().toISOString().split("T")[0];
  return (
    <div
      className={`[&>*:nth-child(odd)]dark:bg-gray-900 [&>*:nth-child(odd)]bg-gray-100 grid grid-cols-subgrid col-span-full last:print:hidden relative group`}
    >
      <div className={defaultOuterCellClasses}>
        <DateInput
          name="date"
          hidden={chargeType?.disabledFields?.includes("date")}
          className={defaultInnerCellClasses}
          defaultValue={date}
          onChange={(v) => onChange({ date: v })}
        />
      </div>
      <div className={`${defaultOuterCellClasses} print:hidden`}>
        <SelectInput
          options={lineTypeOptions}
          className={defaultInnerCellClasses}
          value={item.type}
          onChange={(v) => onChange({ type: v as LineItemType["type"] })}
        />
      </div>
      <div className={defaultOuterCellClasses}>
        <TextInput
          name="description"
          hidden={chargeType?.disabledFields?.includes("description")}
          className={defaultInnerCellClasses}
          value={item.description}
          onChange={(v) => onChange({ description: v })}
        />
      </div>
      <div className={defaultOuterCellClasses}>
        <SelectInput
          name="unit"
          options={lineUnitOptions}
          className={`${defaultInnerCellClasses} ${chargeType?.disabledFields?.includes("unit") && "hidden"}`}
          value={item.name}
          onChange={(v) => onChange({ name: v })}
        />
      </div>
      <div className={defaultOuterCellClasses}>
        <TextInput
          name="qty"
          hidden={chargeType?.disabledFields?.includes("qty")}
          className={`${defaultInnerCellClasses}`}
          value={item.qty === undefined ? undefined : String(item.qty)}
          onChange={(v) => onChange({ qty: parseCurrency(v) })}
        />
      </div>
      <div className={defaultOuterCellClasses}>
        <TextInput
          name="unitPrice"
          hidden={chargeType?.disabledFields?.includes("unitPrice")}
          inputClassName="text-right"
          className={`${defaultInnerCellClasses}`}
          prefix="£"
          value={item.unitPrice === undefined ? undefined : String(item.unitPrice)}
          onChange={(v) => onChange({ unitPrice: parseCurrency(v) })}
        />
      </div>
      <div className={defaultOuterCellClasses}>
        <TextInput
          inputClassName="text-right"
          readOnly
          className={`${defaultInnerCellClasses}`}
          prefix="£"
          value={formatCurrency(linePrice(item)) || undefined}
        />
      </div>
      <div className="flex absolute group-last:hidden print:hidden top-0 bottom-0 left-0 -ml-8">
        <Button title="Delete Line" icon outline contentOnly size="sm" onClick={deleteLineItem} color="danger">
          <XMarkIcon className="h-5" />
        </Button>
      </div>
    </div>
  );
};

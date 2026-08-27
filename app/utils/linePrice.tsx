import { chargeTypes } from "~/components/home/LineItems/LineItem";
import type { LineItem } from "~/components/home/LineItems/LineItemProvider";

export const linePrice = ({ qty, unitPrice, type }: Pick<LineItem, 'qty' | "unitPrice" | "type">) => {
    return chargeTypes.find((chargeType) => chargeType.id === type)?.calculation(Number(qty ?? 0), Number(unitPrice)) ?? 0
}

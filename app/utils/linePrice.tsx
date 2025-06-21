
export const linePrice = ({ qty, unitPrice }: { qty?: number | string; unitPrice?: number | string; }) => Number(qty ?? 0) * Number(unitPrice ?? 0);

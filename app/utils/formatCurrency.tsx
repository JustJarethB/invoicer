export const formatCurrency = (v: number) => Number.isNaN(v) ? (0).toFixed(2) : Number(v).toFixed(2);

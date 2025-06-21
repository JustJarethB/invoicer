export const formatCurrency = (v: number) => Number.isNaN(v) ? "0" : Number(v).toFixed(2);

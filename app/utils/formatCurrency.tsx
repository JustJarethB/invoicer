export const formatCurrency = (v: number) => (Number.isFinite(v) ? Number(v).toFixed(2) : (0).toFixed(2));

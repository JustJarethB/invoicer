export const isValidPaymentAmount = (amount: number) => Number.isFinite(amount) && !Number.isNaN(amount) && amount !== 0;

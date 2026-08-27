
export const ensureFutureCurrency = (v: string) => {
    let result;
    const s = v.toString();
    if (/-/.test(s)) result = "-";
    if (Number.isNaN(parseFloat(v))) return result;
    result = result || "";
    const regRes = s.match(/0*(\d+\.?\d{0,2})/);
    const regMatch = regRes?.[1] || undefined;
    result += regMatch;
    return result;
};

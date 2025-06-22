import { useMemo } from "react";

const save = async (keys: string[], data: any) => {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(JSON.stringify(keys), JSON.stringify(data));
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async operation
    return true
}
const get = async (keys: string[]) => {
    if (typeof localStorage === 'undefined') return null;
    const data = localStorage.getItem(JSON.stringify(keys));
    return data ? JSON.parse(data) : null;
}
const remove = async (keys: string[]) => {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(JSON.stringify(keys));
    return true;
}
export const db = {
    save,
    get,
    remove,
}
export const useDb = () => useMemo(() => db, []);
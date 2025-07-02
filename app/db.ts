import { useMemo } from "react";

const matchPartialKeys = (keys: string[]) => {
    return Array(localStorage.length).fill(0).map((_, i) => localStorage.key(i)).filter((key): key is NonNullable<typeof key> => {
        if (!key) return false;
        try {
            const parsedKey = JSON.parse(key);
            return keys.every(k => parsedKey.includes(k));
        } catch (e) {
            console.error("Failed to parse localStorage key:", key, e);
            return false;
        }
    })
}
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
const getAll = async (keys: string[] = []) => {
    if (typeof localStorage === 'undefined') return [];
    return Promise.all(matchPartialKeys(keys).sort().map(keyStr => get(JSON.parse(keyStr))))
}
const remove = async (keys: string[]) => {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(JSON.stringify(keys));
    return true;
}
export const db = {
    save,
    get,
    getAll,
    remove,
}
export const useDb = () => useMemo(() => db, []);
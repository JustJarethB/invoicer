import { eventBus } from "~/utils/events";
import { logger } from "~/utils/logger";

const matchPartialKeys = (keys: string[]) => {
  const unreadable: string[] = [];
  const result = Array(localStorage.length)
    .fill(0)
    .map((_, i) => localStorage.key(i))
    .filter((key): key is NonNullable<typeof key> => {
      if (!key) return false;
      try {
        const parsedKey = JSON.parse(key);
        return keys.every((k) => parsedKey.includes(k));
      } catch {
        unreadable.push(key);
        return false;
      }
    });
  if (unreadable.length > 0) {
    // One aggregated diagnostics line + one harness event per scan, however
    // many keys are corrupt — a corrupt store must not flood either sink.
    const entryNoun = unreadable.length === 1 ? "entry" : "entries";
    const skippedVerb = unreadable.length === 1 ? "was" : "were";
    logger.error("Failed to parse localStorage keys:", unreadable);
    eventBus.publish({
      type: "storage.unreadable",
      severity: "warning",
      message: `${unreadable.length} saved ${entryNoun} could not be read and ${skippedVerb} skipped`,
      context: { keys: unreadable },
    });
  }
  return result;
};
const save = async <T>(keys: string[], data: T) => {
  if (typeof localStorage === "undefined") return false;
  localStorage.setItem(JSON.stringify(keys), JSON.stringify(data));
  await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
  return true;
};
const get = async <T>(keys: string[]): Promise<T | null> => {
  if (typeof localStorage === "undefined") return null;
  const data = localStorage.getItem(JSON.stringify(keys));
  return data ? JSON.parse(data) : null;
};
const getAll = async <T>(keys: string[] = []): Promise<T[]> => {
  if (typeof localStorage === "undefined") return [];
  return (
    await Promise.all(
      matchPartialKeys(keys)
        .sort()
        .map((keyStr) => get<T>(JSON.parse(keyStr)))
    )
  ).filter((item) => item !== null);
};
const remove = async (keys: string[]) => {
  if (typeof localStorage === "undefined") return false;
  localStorage.removeItem(JSON.stringify(keys));
  return true;
};
export const db = {
  save,
  get,
  getAll,
  remove,
};

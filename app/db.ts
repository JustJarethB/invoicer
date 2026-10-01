import { eventBus } from "~/utils/events";
import { logger } from "~/utils/logger";

type Validator<T> = {
  safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown };
};

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
    const entryNoun = unreadable.length === 1 ? "entry" : "entries";
    const skippedVerb = unreadable.length === 1 ? "was" : "were";
    eventBus.publish({
      type: "storage",
      severity: "warning",
      message: `${unreadable.length} saved ${entryNoun} could not be read and ${skippedVerb} skipped`,
      context: { action: "unreadable", keys: unreadable },
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
/**
 * Rebuild material: the ids stored under a domain's `["<domain>", <id>]` keys,
 * read from the localStorage keys alone — never from the records. A key whose
 * record is missing or unreadable still appears, and no key-equals-record-id
 * assumption is made (callers permit key != id).
 */
const storedIds = async (domain: string): Promise<string[]> => {
  if (typeof localStorage === "undefined") return [];
  const ids: string[] = [];
  for (const keyStr of matchPartialKeys([domain]).sort()) {
    let segments: unknown;
    try {
      segments = JSON.parse(keyStr);
    } catch {
      continue; // matchPartialKeys already warned about the unreadable key
    }
    if (!Array.isArray(segments) || segments.length !== 2) continue;
    const [first, id] = segments;
    // An empty id is never written by production callers and would collide
    // with NULL_CLIENT's "" id, so it is skipped.
    if (first !== domain || typeof id !== "string" || id === "") continue;
    ids.push(id);
  }
  return Array.from(new Set(ids)).sort();
};
/** Validated read: missing, unparseable, or schema-failing records return null; stored JSON is never rewritten. */
const getValidated = async <T>(validator: Validator<T>, keys: string[]): Promise<T | null> => {
  if (typeof localStorage === "undefined") return null;
  const data = localStorage.getItem(JSON.stringify(keys));
  if (!data) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    logger.error(`Stored data for ${JSON.stringify(keys)} could not be parsed as JSON and was skipped`, e);
    return null;
  }
  const result = validator.safeParse(parsed);
  if (!result.success) {
    logger.error(`Stored data for ${JSON.stringify(keys)} failed schema validation and was skipped`, result.error);
    return null;
  }
  return result.data;
};
/** Validated list read: schema-failing records are skipped; keys are sorted as in getAll, preserving list ordering. */
const getAllValidated = async <T>(validator: Validator<T>, keys: string[] = []): Promise<T[]> => {
  if (typeof localStorage === "undefined") return [];
  return (
    await Promise.all(
      matchPartialKeys(keys)
        .sort()
        .map((keyStr) => getValidated(validator, JSON.parse(keyStr)))
    )
  ).filter((record) => record !== null);
};
export const db = {
  save,
  get,
  getAll,
  remove,
  getValidated,
  getAllValidated,
  storedIds,
};

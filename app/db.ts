import { eventBus } from "~/utils/events";
import { logger } from "~/utils/logger";

/**
 * Structural validator contract for the validated read seam (issue #43).
 * Deliberately library-agnostic: any parser exposing `safeParse(data: unknown)`
 * with zod's result shape satisfies it, so `db` never imports a validation
 * library and schemas stay co-located with their domain modules. Zod v4
 * schemas (imported from `zod/mini`) satisfy this contract directly.
 */
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
 * Validated read of one persisted record (issue #43). The caller supplies the
 * schema for the key's shape; the schema decides what the app accepts.
 *
 * Read-failure policy: a record that is missing, is not valid JSON, or fails
 * its schema is reported through the logger and treated as absent — `null`
 * here, and (via `getAllValidated`) filtered out of list reads. Legacy numeric
 * strings for money quantities, blank optional fields, and absent
 * legacy-only keys are accepted by the domain schemas (app/data/*), so this
 * path only skips genuinely malformed records. Stored JSON is never rewritten
 * on read; canonical values are persisted only on a deliberate save.
 */
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
/**
 * Validated list read: every matching record is checked with the same schema
 * as `getValidated`, and records that fail are skipped. Matching keys are
 * sorted first, as in `getAll`, so list ordering is unchanged.
 */
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
};

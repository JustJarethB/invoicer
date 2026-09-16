import { logger } from "~/utils/logger";
import { booleanSchema, parseAddress, parseClient, parseClientKeys, parseInvoice, parseLogo, parsePaymentDetails, parseStringArray } from "~/data/schemas";
import { z } from "zod/mini";

/** `z.safeParse` over the persisted-boolean schema (the showTutorial flag). */
const booleanValidator = (data: unknown) => z.safeParse(booleanSchema, data);

/**
 * Registry mapping a domain key's first segment to the validator for every
 * record stored under it. The validator turns the raw JSON.parse output
 * (unknown) into either a validated value or a rejection, so corrupt or
 * legacy-shaped data can never masquerade as a valid record (audit S1–S5).
 * The same table validates writes (audit G7): data that fails its domain
 * schema is refused instead of persisted.
 *
 * The Autosave forms persist under the same keys the loaders read
 * (`from-address`, `payment-details`, `logo`), so one validator per domain
 * covers both directions; the payment-details schema defaults the fields its
 * form does not render.
 *
 * The first segment of a persisted key picks the validator; the remaining
 * segments are opaque record ids. A first segment without a registered
 * validator is a programmer error (a new domain key without a schema) and is
 * rejected loudly rather than trusted.
 */
const recordValidators = {
  clientKeys: parseClientKeys,
  clients: parseClient,
  "from-address": parseAddress,
  invoice: parseInvoice,
  logo: parseLogo,
  "payment-details": parsePaymentDetails,
  showTutorial: booleanValidator,
} as const;

type DomainKeys = keyof typeof recordValidators;

/** The validated record type a domain key reads back as. */
export type RecordOf<K extends DomainKeys> = Extract<ReturnType<(typeof recordValidators)[K]>, { success: true }>["data"];

/**
 * Single correlation point between a key's domain segment and its validator.
 * The registry's `as const` shape guarantees `recordValidators[K]` returns
 * `RecordOf<K>` on success; TypeScript cannot carry that correlation through
 * the indexed access, so this one internal cast replaces the eight
 * caller-supplied `db.get<T>` trust points the audit flagged (G1–G6).
 */
const readValidated = <K extends DomainKeys>(domain: K, keys: [K, ...string[]], parsed: unknown): RecordOf<K> | null => {
  const result = recordValidators[domain](parsed);
  if (!result.success) {
    logger.error(`Stored data for ${JSON.stringify(keys)} failed schema validation.`);
    return null;
  }
  return result.data as RecordOf<K>;
};

const matchPartialKeys = (keys: string[]) => {
  return Array(localStorage.length)
    .fill(undefined)
    .map((_, i) => localStorage.key(i))
    .filter((key): key is NonNullable<typeof key> => {
      if (!key) return false;
      try {
        const parsedKey: unknown = JSON.parse(key);
        return Array.isArray(parsedKey) && keys.every((k) => parsedKey.includes(k));
      } catch (e) {
        logger.error("Failed to parse localStorage key:", key, e);
        return false;
      }
    });
};

/**
 * Validate a record against its domain schema and serialise it. Returns the
 * JSON string to persist, or null when the data fails validation — the caller
 * refuses the write instead of storing unvalidated data (audit G7).
 */
const validatedJson = <K extends DomainKeys>(keys: [K, ...string[]], data: RecordOf<K>): string | null => {
  const result = recordValidators[keys[0]](data);
  if (!result.success) {
    logger.error(`Refused to save data for ${JSON.stringify(keys)}: failed schema validation.`);
    return null;
  }
  return JSON.stringify(result.data);
};

const save = async <K extends DomainKeys>(keys: [K, ...string[]], data: RecordOf<K>) => {
  if (typeof localStorage === "undefined") return false;
  const json = validatedJson(keys, data);
  if (json === null) return false;
  localStorage.setItem(JSON.stringify(keys), json);
  await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
  return true;
};

/**
 * Persist a raw form record (the output of `formJson`) under a domain key.
 * The domain schema validates the record and strips unknown fields, so only
 * schema-clean data reaches storage. Returns false when the record fails its
 * domain schema (e.g. an empty logo form).
 */
const saveForm = async (domain: "from-address" | "payment-details" | "logo", record: Record<string, string>) => {
  if (typeof localStorage === "undefined") return false;
  const result = recordValidators[domain](record);
  if (!result.success) {
    logger.error(`Refused to save form record for ${JSON.stringify([domain])}: failed schema validation.`);
    return false;
  }
  localStorage.setItem(JSON.stringify([domain]), JSON.stringify(result.data));
  await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
  return true;
};

/**
 * Read and validate a persisted record. Returns null when the key is missing,
 * the JSON is unparseable, the domain has no registered validator, or the
 * value does not match its domain schema.
 */
const get = async <K extends DomainKeys>(keys: [K, ...string[]]): Promise<RecordOf<K> | null> => {
  if (typeof localStorage === "undefined") return null;
  const data = localStorage.getItem(JSON.stringify(keys));
  if (!data) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    logger.error(`Stored data for ${JSON.stringify(keys)} is not valid JSON:`, e);
    return null;
  }
  return readValidated(keys[0], keys, parsed);
};

const getAll = async <K extends DomainKeys>(keys: [K, ...string[]]): Promise<Array<RecordOf<K>>> => {
  if (typeof localStorage === "undefined") return [];
  const domain = keys[0];
  const keyStrings = matchPartialKeys(keys).sort();
  const reads: Array<RecordOf<K> | null> = [];
  for (const keyStr of keyStrings) {
    let parsedKey: unknown;
    try {
      parsedKey = JSON.parse(keyStr);
    } catch (e) {
      logger.error("Failed to parse localStorage key:", keyStr, e);
      continue;
    }
    const key = parseStringArray(parsedKey);
    if (!key.success) continue;
    const [first, ...rest] = key.data;
    if (first !== domain) continue;
    reads.push(await get([domain, ...rest]));
  }
  return reads.filter((item) => item !== null);
};

const remove = async (keys: string[]) => {
  if (typeof localStorage === "undefined") return false;
  localStorage.removeItem(JSON.stringify(keys));
  await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
  return true;
};

export const db = {
  get,
  getAll,
  remove,
  save,
  saveForm,
};

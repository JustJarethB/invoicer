/**
 * crypto.randomUUID() is unavailable in some older test environments (jsdom on
 * Node 20), so fall back to a compact v4 generator when needed. Both paths
 * require WebCrypto: the fallback uses crypto.getRandomValues. An environment
 * with no crypto at all cannot generate a UUID and should fail loudly.
 */
export const randomUUID = (): string => {
  if (typeof crypto === "undefined") throw new Error("WebCrypto is unavailable in this environment.");
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16)
  );
};
